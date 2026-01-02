from typing import List, Dict, Any
from .job import Job


def compute_metrics(completed: List[Job], all_jobs: List[Job], sim_duration: float) -> Dict[str, Any]:
    latencies = sorted([j.latency for j in completed if j.latency is not None])
    jobs_with_deadlines = [j for j in completed if j.deadline is not None]
    missed = [j for j in jobs_with_deadlines if j.missed_deadline]
    
    # Jain's Fairness Index by owner
    owner_cpu = {}
    for job in completed:
        run_time = job.duration - job.remaining_time
        owner_cpu[job.owner] = owner_cpu.get(job.owner, 0) + run_time
    
    if len(owner_cpu) > 1:
        vals = list(owner_cpu.values())
        n = len(vals)
        fairness = (sum(vals) ** 2) / (n * sum(v**2 for v in vals))
    else:
        fairness = 1.0
    
    def pct(data, p):
        if not data:
            return 0
        idx = max(0, min(int(len(data) * p / 100), len(data) - 1))
        return round(data[idx], 2)
    
    return {
        "p50_latency": pct(latencies, 50),
        "p95_latency": pct(latencies, 95),
        "p99_latency": pct(latencies, 99),
        "throughput": round(len(completed) / max(sim_duration / 1000, 0.001), 2),
        "fairness_index": round(fairness, 4),
        "deadline_miss_rate": round(len(missed) / len(jobs_with_deadlines), 4) if jobs_with_deadlines else None,
        "total_jobs": len(all_jobs),
        "completed_jobs": len(completed),
        "starved_jobs": sum(1 for j in completed if j.wait_time > 30000),
        "total_preemptions": sum(j.preempt_count for j in completed),
    }
