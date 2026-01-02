from typing import List, Callable, Any, Dict, Optional


class FusionScheduler:
    """
    A scheduler that dynamically chooses between multiple algorithms
    based on job characteristics and fusion rules.
    """
    
    def __init__(
        self,
        schedulers: List[Callable],
        scheduler_names: List[str],
        rule: str,
        threshold: Optional[int] = None,
        is_preemptive: bool = True
    ):
        self.schedulers = schedulers
        self.scheduler_names = scheduler_names
        self.rule = rule
        self.threshold = threshold or 500  # Default 500ms threshold
        self.is_preemptive = is_preemptive
        
    def _select_scheduler_for_job(self, job: Any, ready_jobs: List[Any], cluster: Any, now: int) -> Callable:
        """
        Select the appropriate scheduler based on the fusion rule for a given job.
        """
        if not job:
            return self.schedulers[0]
        
        if self.rule == "priority":
            return self._select_by_priority(job, ready_jobs)
        elif self.rule == "duration":
            return self._select_by_duration(job, ready_jobs)
        elif self.rule == "deadline":
            return self._select_by_deadline(job, ready_jobs)
        elif self.rule == "gpu":
            return self._select_by_gpu(job, ready_jobs)
        else:
            return self.schedulers[0]
    
    def _select_by_priority(self, job: Any, ready_jobs: List[Any]) -> Callable:
        """
        Priority-based fusion:
        - High priority (>=0.7): Use first scheduler
        - Medium priority (0.3-0.7): Use second scheduler
        - Low priority (<0.3): Use third scheduler or fallback
        """
        priority = getattr(job, 'priority', 0.5)
        
        if priority >= 0.7:
            return self.schedulers[0] if len(self.schedulers) > 0 else self.schedulers[0]
        elif priority >= 0.3:
            return self.schedulers[1] if len(self.schedulers) > 1 else self.schedulers[0]
        else:
            return self.schedulers[2] if len(self.schedulers) > 2 else self.schedulers[-1]
    
    def _select_by_duration(self, job: Any, ready_jobs: List[Any]) -> Callable:
        """
        Duration-based fusion:
        - Short jobs (< threshold): Use first scheduler
        - Long jobs (>= threshold): Use second scheduler
        """
        duration = getattr(job, 'remaining_time', getattr(job, 'duration', 0))
        
        if duration < self.threshold:
            return self.schedulers[0] if len(self.schedulers) > 0 else self.schedulers[0]
        else:
            return self.schedulers[1] if len(self.schedulers) > 1 else self.schedulers[-1]
    
    def _select_by_deadline(self, job: Any, ready_jobs: List[Any]) -> Callable:
        """
        Deadline-aware fusion:
        - Jobs with deadlines: Use first scheduler (typically EDF)
        - Jobs without deadlines: Use second scheduler (typically SRPT)
        """
        deadline = getattr(job, 'deadline', None)
        
        if deadline is not None:
            return self.schedulers[0] if len(self.schedulers) > 0 else self.schedulers[0]
        else:
            return self.schedulers[1] if len(self.schedulers) > 1 else self.schedulers[-1]
    
    def _select_by_gpu(self, job: Any, ready_jobs: List[Any]) -> Callable:
        """
        GPU-aware fusion:
        - GPU jobs: Use first scheduler
        - CPU-only jobs: Use second scheduler
        """
        requires_gpu = getattr(job, 'requires_gpu', False)
        
        if requires_gpu:
            return self.schedulers[0] if len(self.schedulers) > 0 else self.schedulers[0]
        else:
            return self.schedulers[1] if len(self.schedulers) > 1 else self.schedulers[-1]
    
    def __call__(self, ready_jobs: List[Any], running_jobs: List[Any], cluster: Any, now: int) -> Any:
        """
        Main scheduling function - selects the best job using the fused algorithm.
        
        Strategy: Categorize all ready jobs by which scheduler should handle them,
        then let each scheduler pick from its category. Return the job selected by
        the highest-priority category.
        """
        if not ready_jobs:
            return None
        
        # Group jobs by which scheduler should handle them
        job_groups = {}
        for job in ready_jobs:
            scheduler = self._select_scheduler_for_job(job, ready_jobs, cluster, now)
            if scheduler not in job_groups:
                job_groups[scheduler] = []
            job_groups[scheduler].append(job)
        
        # Ask each scheduler to pick the best job from its group
        best_job = None
        best_score = float('-inf')
        
        for scheduler, jobs in job_groups.items():
            if not jobs:
                continue
            # Let this scheduler pick from its jobs
            selected = scheduler(jobs, running_jobs, cluster, now)
            if selected is not None:
                # Score this job (higher is better)
                score = self._score_job(selected, now)
                if score > best_score:
                    best_score = score
                    best_job = selected
        
        return best_job
    
    def _score_job(self, job: Any, now: int) -> float:
        """
        Score a job for priority when multiple schedulers have candidates.
        Higher score = higher priority to run.
        """
        score = 0.0
        
        # Deadline urgency (highest priority)
        deadline = getattr(job, 'deadline', None)
        if deadline is not None:
            time_left = deadline - now
            if time_left > 0:
                score += 1000.0 / max(time_left, 1)  # Urgent if deadline soon
        
        # Priority contribution
        score += getattr(job, 'priority', 0.5) * 100
        
        # Inverse of remaining time (shorter jobs get slight boost)
        remaining = getattr(job, 'remaining_time', getattr(job, 'duration', 1000))
        score += 1000.0 / max(remaining, 1)
        
        return score


def make_fusion_scheduler(
    algorithm_configs: List[dict],
    fusion_config: dict,
    global_params: dict
) -> FusionScheduler:
    """
    Factory function to create a fusion scheduler.
    """
    from . import get_scheduler
    
    # Create individual schedulers
    schedulers = []
    scheduler_names = []
    for algo_config in algorithm_configs:
        scheduler = get_scheduler(algo_config, global_params, fusion_config=None)
        schedulers.append(scheduler)
        scheduler_names.append(algo_config.get("id", "unknown"))
    
    if not schedulers:
        raise ValueError("No schedulers provided for fusion")
    
    return FusionScheduler(
        schedulers=schedulers,
        scheduler_names=scheduler_names,
        rule=fusion_config.get("rule", "duration"),
        threshold=fusion_config.get("threshold", 500),
        is_preemptive=True
    )
