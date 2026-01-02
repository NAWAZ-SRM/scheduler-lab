from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from typing import List

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.scheduler import (
    SaveSchedulerRequest, ValidateRequest, ValidationResponse,
    SchedulerSummary, SchedulerDetail
)
from app.models.custom_scheduler import CustomScheduler
from app.models.user import User
from app.simulation.js_sandbox import validate_js_code

router = APIRouter(prefix="/schedulers", tags=["schedulers"])


@router.get("", response_model=List[SchedulerSummary])
async def list_schedulers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CustomScheduler)
        .where(CustomScheduler.user_id == current_user.id)
        .order_by(desc(CustomScheduler.updated_at))
    )
    schedulers = result.scalars().all()
    
    return [
        SchedulerSummary(
            id=s.id,
            name=s.name,
            is_preemptive=s.is_preemptive,
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in schedulers
    ]


@router.post("", response_model=SchedulerSummary, status_code=201)
async def create_scheduler(
    request: SaveSchedulerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Validate code
    validation = validate_js_code(request.code)
    if not validation.valid:
        raise HTTPException(
            status_code=400,
            detail={"error": validation.errors[0].message, "line": validation.errors[0].line}
        )
    
    scheduler = CustomScheduler(
        user_id=current_user.id,
        name=request.name,
        code=request.code,
        is_preemptive=request.is_preemptive
    )
    db.add(scheduler)
    await db.commit()
    await db.refresh(scheduler)
    
    return SchedulerSummary(
        id=scheduler.id,
        name=scheduler.name,
        is_preemptive=scheduler.is_preemptive,
        created_at=scheduler.created_at,
        updated_at=scheduler.updated_at
    )


@router.put("/{scheduler_id}", response_model=SchedulerSummary)
async def update_scheduler(
    scheduler_id: UUID,
    request: SaveSchedulerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CustomScheduler).where(
            CustomScheduler.id == scheduler_id,
            CustomScheduler.user_id == current_user.id
        )
    )
    scheduler = result.scalar_one_or_none()
    
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    
    # Validate code
    validation = validate_js_code(request.code)
    if not validation.valid:
        raise HTTPException(
            status_code=400,
            detail={"error": validation.errors[0].message, "line": validation.errors[0].line}
        )
    
    scheduler.name = request.name
    scheduler.code = request.code
    scheduler.is_preemptive = request.is_preemptive
    await db.commit()
    await db.refresh(scheduler)
    
    return SchedulerSummary(
        id=scheduler.id,
        name=scheduler.name,
        is_preemptive=scheduler.is_preemptive,
        created_at=scheduler.created_at,
        updated_at=scheduler.updated_at
    )


@router.delete("/{scheduler_id}", status_code=204)
async def delete_scheduler(
    scheduler_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CustomScheduler).where(
            CustomScheduler.id == scheduler_id,
            CustomScheduler.user_id == current_user.id
        )
    )
    scheduler = result.scalar_one_or_none()
    
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    
    await db.delete(scheduler)
    await db.commit()
    
    return None


@router.post("/validate", response_model=ValidationResponse)
async def validate_scheduler(request: ValidateRequest):
    return validate_js_code(request.code)
