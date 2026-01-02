from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class Job:
    id: str
    arrival_time: float
    duration: float
    remaining_time: float
    priority: float
    requires_gpu: bool
    deadline: Optional[float]
    owner: str = "default"
    
    # Runtime tracking
    start_time: Optional[float] = None
    completion_time: Optional[float] = None
    preempt_count: int = 0
    wait_time: float = 0.0
    last_wait_update: Optional[float] = None
    segments: List[Dict[str, Any]] = field(default_factory=list)
    
    @property
    def latency(self) -> Optional[float]:
        if self.completion_time is None:
            return None
        return self.completion_time - self.arrival_time
    
    @property
    def missed_deadline(self) -> bool:
        if self.deadline is None or self.completion_time is None:
            return False
        return self.completion_time > self.deadline
