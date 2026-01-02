from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from uuid import UUID, uuid4
import asyncio
import json
from typing import List, Dict, Any
from datetime import datetime

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.simulation import (
    RunRequest, RunResponse, SaveRunRequest,
    SimulationRunSummary, SimulationRunsList
)
from app.models.simulation_run import SimulationRun
from app.models.user import User
from app.simulation.runner import run_simulation

router = APIRouter(prefix="/simulations", tags=["simulations"])

# In-memory store for run tokens (in production, use Redis)
run_tokens: Dict[str, Dict[str, Any]] = {}


@router.post("/run", response_model=RunResponse)
async def create_run(
    request: RunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    run_token = f"tmp_{uuid4().hex[:12]}"
    
    # Basic validations per PRD
    algos = [a.model_dump() for a in request.algorithms]
    if len(algos) < 1 or len(algos) > 3:
        raise HTTPException(status_code=400, detail="Must select between 1 and 3 algorithms")

    # If custom algorithm provided, validate code quickly
    from app.simulation.js_sandbox import validate_js_code
    for a in algos:
        if a.get("id") == "custom":
            code = a.get("code") or ""
            validation = validate_js_code(code)
            if not validation.valid:
                raise HTTPException(status_code=400, detail={"error": validation.errors[0].message, "line": validation.errors[0].line})

    # Validate custom_jobs limit if provided
    workload = request.workload.model_dump()
    from app.config import get_settings
    settings = get_settings()
    if workload.get("source") == "json" and workload.get("custom_jobs"):
        if len(workload["custom_jobs"]) > settings.MAX_CUSTOM_JOBS:
            raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_CUSTOM_JOBS} custom jobs allowed")

    # Get fusion config if provided
    fusion = request.fusion.model_dump() if request.fusion else None

    run_tokens[run_token] = {
        "user_id": str(current_user.id),
        "workload": workload,
        "algorithms": algos,
        "fusion": fusion,
        "global_params": request.global_params.model_dump(),
        "status": "pending",
        "results": None,
        "progress": 0,
        "message": "Waiting to start...",
        "created_at": datetime.utcnow(),
        "streamed": False,
    }
    
    return RunResponse(run_token=run_token)


async def event_generator(run_token: str):
    run_data = run_tokens.get(run_token)
    if not run_data:
        yield f"event: error\ndata: {json.dumps({'message': 'Run not found'})}\n\n"
        return
    # progress callback updates shared token state
    def progress_callback(percent: int, message: str):
        run_tokens[run_token]["progress"] = percent
        run_tokens[run_token]["message"] = message

    loop = asyncio.get_event_loop()

    # Get fusion config
    fusion_config = run_data.get("fusion")

    # Start simulation in executor
    sim_future = loop.run_in_executor(
        None,
        lambda: run_simulation(
            run_data["workload"],
            run_data["algorithms"],
            run_data["global_params"],
            progress_callback,
            fusion_config
        )
    )

    last_pct = -1
    try:
        # While simulation is running, stream progress events periodically
        while not sim_future.done():
            current = run_tokens.get(run_token)
            if not current:
                break
            pct = current.get("progress", 0)
            msg = current.get("message", "")
            if pct != last_pct:
                last_pct = pct
                yield f"event: progress\ndata: {json.dumps({'percent': pct, 'message': msg})}\n\n"
            await asyncio.sleep(0.25)

        # Await final result (or exception)
        results = await sim_future
        run_tokens[run_token]["results"] = results
        run_tokens[run_token]["status"] = "complete"

        yield f"event: complete\ndata: {json.dumps(results)}\n\n"

    except Exception as e:
        run_tokens[run_token]["status"] = "error"
        yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"


@router.get("/stream/{run_token}")
async def stream_simulation(run_token: str):
    return StreamingResponse(
        event_generator(run_token),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.post("/save")
async def save_run(
    request: SaveRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    run_data = run_tokens.get(request.run_token)
    if not run_data:
        raise HTTPException(status_code=404, detail="Run not found or expired")
    
    if run_data["status"] != "complete":
        raise HTTPException(status_code=400, detail="Simulation not complete")
    
    # Create share token
    share_token = uuid4().hex[:32]
    
    # Extract algorithm names for the summary
    algo_names = [a.get("id", "unknown").upper() for a in run_data["algorithms"]]
    
    # Extract primary metrics
    results = run_data["results"]
    primary_p95 = results[0]["metrics"]["p95_latency"] if results else 0
    primary_throughput = results[0]["metrics"]["throughput"] if results else 0
    
    run = SimulationRun(
        user_id=current_user.id,
        name=request.name,
        workload_config=run_data["workload"],
        algorithms_config=run_data["algorithms"],
        results=run_data["results"],
        share_token=share_token
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    # Clean up token
    del run_tokens[request.run_token]
    
    return {"id": str(run.id), "share_token": share_token}


@router.get("", response_model=SimulationRunsList)
async def list_runs(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get total count
    count_result = await db.execute(
        select(func.count()).where(SimulationRun.user_id == current_user.id)
    )
    total = count_result.scalar()
    
    # Get paginated runs
    offset = (page - 1) * limit
    result = await db.execute(
        select(SimulationRun)
        .where(SimulationRun.user_id == current_user.id)
        .order_by(desc(SimulationRun.created_at))
        .offset(offset)
        .limit(limit)
    )
    runs = result.scalars().all()
    
    summaries = []
    for run in runs:
        algo_names = [a.get("id", "unknown").upper() for a in run.algorithms_config]
        primary_results = run.results[0] if run.results else {"metrics": {}}
        metrics = primary_results.get("metrics", {})
        
        summaries.append(SimulationRunSummary(
            id=run.id,
            name=run.name,
            algorithms=algo_names,
            preset=run.workload_config.get("preset", "custom"),
            primary_p95=metrics.get("p95_latency", 0),
            primary_throughput=metrics.get("throughput", 0),
            created_at=run.created_at,
            share_token=run.share_token
        ))
    
    return SimulationRunsList(
        runs=summaries,
        total=total,
        page=page,
        pages=(total + limit - 1) // limit
    )


@router.get("/{run_id}")
async def get_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SimulationRun).where(
            SimulationRun.id == run_id,
            SimulationRun.user_id == current_user.id
        )
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return {
        "id": str(run.id),
        "name": run.name,
        "workload_config": run.workload_config,
        "algorithms_config": run.algorithms_config,
        "results": run.results,
        "share_token": run.share_token,
        "created_at": run.created_at.isoformat()
    }


@router.delete("/{run_id}", status_code=204)
async def delete_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SimulationRun).where(
            SimulationRun.id == run_id,
            SimulationRun.user_id == current_user.id
        )
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    await db.delete(run)
    await db.commit()
    
    return None


@router.get("/shared/{share_token}")
async def get_shared_run(share_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SimulationRun).where(SimulationRun.share_token == share_token)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Shared run not found")
    
    return {
        "id": str(run.id),
        "name": run.name,
        "workload_config": run.workload_config,
        "algorithms_config": run.algorithms_config,
        "results": run.results,
        "created_at": run.created_at.isoformat()
    }
