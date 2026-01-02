from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from datetime import datetime


class WorkloadConfig(BaseModel):
    source: str = "form"
    preset: str = "custom"
    total_jobs: int = Field(default=50, ge=10, le=500)
    arrival_pattern: str = "poisson"
    arrival_rate: int = Field(default=10, ge=1, le=100)
    simulation_window: int = Field(default=120, ge=10, le=600)
    duration_min: int = Field(default=100, ge=10, le=10000)
    duration_max: int = Field(default=500, ge=100, le=600000)
    duration_variance: int = Field(default=3, ge=1, le=10)
    pct_with_deadlines: int = Field(default=0, ge=0, le=100)
    deadline_tightness: float = Field(default=2.0, ge=1.2, le=5.0)
    pct_gpu_jobs: int = Field(default=0, ge=0, le=100)
    priority_spread: int = Field(default=1, ge=1, le=5)
    cluster_slots: int = Field(default=8, ge=1, le=64)
    cluster_gpu_slots: int = Field(default=0, ge=0, le=8)
    custom_jobs: Optional[List[Dict[str, Any]]] = None


class AlgorithmSelection(BaseModel):
    id: str
    params: Dict[str, Any] = {}
    custom_scheduler_id: Optional[UUID] = None
    code: Optional[str] = None


class FusionConfig(BaseModel):
    name: str
    algorithms: List[str]
    rule: Literal['priority', 'duration', 'deadline', 'gpu']
    threshold: Optional[int] = None


class GlobalParams(BaseModel):
    starvation_threshold: int = Field(default=30, ge=1, le=120)
    preemption_cost: int = Field(default=0, ge=0, le=10)


class RunRequest(BaseModel):
    workload: WorkloadConfig
    algorithms: List[AlgorithmSelection]
    fusion: Optional[FusionConfig] = None
    global_params: GlobalParams = GlobalParams()


class RunResponse(BaseModel):
    run_token: str


class SaveRunRequest(BaseModel):
    name: str
    run_token: str


class SimulationRunSummary(BaseModel):
    id: UUID
    name: Optional[str]
    algorithms: List[str]
    preset: str
    primary_p95: float
    primary_throughput: float
    created_at: datetime
    share_token: Optional[str]
    
    class Config:
        from_attributes = True


class SimulationRunsList(BaseModel):
    runs: List[SimulationRunSummary]
    total: int
    page: int
    pages: int
