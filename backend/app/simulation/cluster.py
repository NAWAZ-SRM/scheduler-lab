from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RunningJob:
    job: object
    slot: int
    gpu_slot: Optional[int]
    started_at: float


@dataclass
class Cluster:
    total_slots: int
    total_gpu_slots: int = 0
    free_slots: int = field(init=False)
    free_gpu_slots: int = field(init=False)
    
    def __post_init__(self):
        self.free_slots = self.total_slots
        self.free_gpu_slots = self.total_gpu_slots
    
    def has_free_slot(self) -> bool:
        return self.free_slots > 0
    
    def snapshot(self) -> dict:
        return {
            "total_slots": self.total_slots,
            "free_slots": self.free_slots,
            "total_gpu_slots": self.total_gpu_slots,
            "free_gpu_slots": self.free_gpu_slots
        }
    
    def allocate(self, job, current_time: float) -> RunningJob:
        slot = self.total_slots - self.free_slots
        gpu_slot = None
        
        if job.requires_gpu:
            if self.free_gpu_slots > 0:
                gpu_slot = self.total_gpu_slots - self.free_gpu_slots
                self.free_gpu_slots -= 1
            else:
                raise ValueError("No free GPU slots")
        
        self.free_slots -= 1
        return RunningJob(job=job, slot=slot, gpu_slot=gpu_slot, started_at=current_time)
    
    def release(self, running_job: RunningJob):
        self.free_slots += 1
        if running_job.gpu_slot is not None:
            self.free_gpu_slots += 1
