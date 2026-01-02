import heapq
from dataclasses import dataclass, field
from typing import Callable, Optional, List, Dict, Any
from .job import Job
from .cluster import Cluster, RunningJob


@dataclass(order=True)
class Event:
    time: float
    type: str = field(compare=False)
    job: Optional[Job] = field(default=None, compare=False)


class Simulator:
    def __init__(self, jobs: List[Job], scheduler_fn, global_params: dict):
        self.jobs = sorted(jobs, key=lambda j: j.arrival_time)
        self.scheduler_fn = scheduler_fn
        self.global_params = global_params
        self.starvation_threshold = global_params.get("starvation_threshold", 30) * 1000
        self.preemption_cost = global_params.get("preemption_cost", 0)
        
        cluster_slots = global_params.get("cluster_slots", 8)
        cluster_gpu_slots = global_params.get("cluster_gpu_slots", 0)
        self.cluster = Cluster(total_slots=cluster_slots, total_gpu_slots=cluster_gpu_slots)
        
        self.ready_queue: List[Job] = []
        self.running: List[RunningJob] = []
        self.completed: List[Job] = []
        self.event_queue: List[Event] = []
        self.time: float = 0.0
        
        # Chart data
        self.queue_depth_series: List[Dict[str, Any]] = []
        self.utilization_series: List[Dict[str, Any]] = []
        self.snapshot_interval: float = 1000.0
        self.last_snapshot: float = 0.0
        self.event_count: int = 0
    
    def run(self, on_event: Callable = None) -> dict:
        # Seed arrival events
        for job in self.jobs:
            heapq.heappush(self.event_queue, Event(job.arrival_time, "arrival", job))
        
        while self.event_queue:
            event = heapq.heappop(self.event_queue)
            self.time = event.time
            self.event_count += 1
            
            if on_event and self.event_count % 50 == 0:
                on_event(self.event_count)
            
            # Update wait times for queued jobs
            for q_job in self.ready_queue:
                elapsed = self.time - (q_job.last_wait_update or q_job.arrival_time)
                q_job.wait_time += elapsed
                q_job.last_wait_update = self.time
            
            if event.type == "arrival":
                self.ready_queue.append(event.job)
                self._try_schedule()
                if getattr(self.scheduler_fn, "preemptive", False):
                    self._try_preempt()
            
            elif event.type == "complete":
                self._handle_completion(event.job)
            
            self._maybe_snapshot()
        
        return self._build_result()
    
    def _handle_completion(self, job: Job):
        entry = next((r for r in self.running if r.job.id == job.id), None)
        if entry is None:
            return
        
        self.running.remove(entry)
        self.cluster.release(entry)
        
        # Close the last segment
        if job.segments:
            job.segments[-1]["end"] = self.time
        
        job.completion_time = self.time
        self.completed.append(job)
        self._try_schedule()
    
    def _try_schedule(self):
        while self.cluster.has_free_slot():
            eligible = [j for j in self.ready_queue
                       if not (j.requires_gpu and self.cluster.free_gpu_slots == 0)]
            if not eligible:
                break
            
            cluster_snap = self.cluster.snapshot()
            chosen = self.scheduler_fn(
                eligible,
                [r.job for r in self.running],
                cluster_snap,
                self.time
            )
            
            if chosen is None or chosen not in self.ready_queue:
                break
            
            self.ready_queue.remove(chosen)
            
            if chosen.start_time is None:
                chosen.start_time = self.time
            
            entry = self.cluster.allocate(chosen, self.time)
            self.running.append(entry)
            
            # Record segment
            chosen.segments.append({
                "start": self.time,
                "end": None,
                "slot": entry.slot
            })
            
            completion_time = self.time + chosen.remaining_time
            heapq.heappush(self.event_queue, Event(completion_time, "complete", chosen))
    
    def _try_preempt(self):
        if not self.ready_queue or not self.running:
            return
        
        cluster_snap = self.cluster.snapshot()
        all_ready = [j for j in self.ready_queue
                    if not (j.requires_gpu and self.cluster.free_gpu_slots == 0)]
        if not all_ready:
            return
        
        chosen = self.scheduler_fn(
            all_ready,
            [r.job for r in self.running],
            cluster_snap,
            self.time
        )
        
        if chosen is None or chosen not in self.ready_queue:
            return
        
        # Find worst running job to preempt (most remaining time)
        preempt_entry = max(self.running, key=lambda r: r.job.remaining_time - (self.time - r.started_at))
        current_remaining = preempt_entry.job.remaining_time - (self.time - preempt_entry.started_at)
        
        # 5% threshold to avoid thrashing
        if current_remaining <= chosen.remaining_time * 1.05:
            return
        
        # Preempt
        preempt_entry.job.remaining_time = current_remaining
        preempt_entry.job.preempt_count += 1
        
        # Apply preemption cost
        if self.preemption_cost > 0:
            preempt_entry.job.remaining_time += self.preemption_cost
        
        # Close segment for preempted job
        if preempt_entry.job.segments:
            preempt_entry.job.segments[-1]["end"] = self.time
        
        # Remove the old completion event
        self.event_queue = [e for e in self.event_queue
                           if not (e.type == "complete" and e.job.id == preempt_entry.job.id)]
        heapq.heapify(self.event_queue)
        
        self.cluster.release(preempt_entry)
        self.running.remove(preempt_entry)
        self.ready_queue.append(preempt_entry.job)
        
        self._try_schedule()
    
    def _maybe_snapshot(self):
        if self.time - self.last_snapshot >= self.snapshot_interval:
            self.queue_depth_series.append({
                "time": int(self.time),
                "depth": len(self.ready_queue)
            })
            self.utilization_series.append({
                "time": int(self.time),
                "slots_used": len(self.running),
                "gpu_used": sum(1 for r in self.running if r.job.requires_gpu)
            })
            self.last_snapshot = self.time
    
    def _build_result(self) -> dict:
        from .metrics import compute_metrics
        from .gantt import build_gantt_data
        
        metrics = compute_metrics(self.completed, self.jobs, self.time)
        metrics["avg_queue_depth"] = (
            sum(s["depth"] for s in self.queue_depth_series) / len(self.queue_depth_series)
            if self.queue_depth_series else 0
        )
        
        return {
            "metrics": metrics,
            "gantt_data": build_gantt_data(self.completed, self.cluster.total_slots, self.time, self.starvation_threshold),
            "queue_depth_series": self.queue_depth_series,
            "utilization_series": self.utilization_series,
        }
