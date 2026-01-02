from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class SaveSchedulerRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1)
    is_preemptive: bool = False


class ValidateRequest(BaseModel):
    code: str


class ValidationError(BaseModel):
    message: str
    line: Optional[int] = None


class ValidationResponse(BaseModel):
    valid: bool
    errors: List[ValidationError] = []


class SchedulerSummary(BaseModel):
    id: UUID
    name: str
    is_preemptive: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SchedulerDetail(BaseModel):
    id: UUID
    name: str
    code: str
    is_preemptive: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
