import numpy as np
from typing import List, Dict, Any
from .job import Job


def generate_workload(config: dict) -> List[Job]:
    """Generate a list of jobs based on workload configuration."""
    if config.get("source") == "json" and config.get("custom_jobs"):
        return _parse_custom_jobs(config["custom_jobs"])
    return _generate_from_form(config)


def _parse_custom_jobs(custom_jobs: List[Dict[str, Any]]) -> List[Job]:
    """Parse custom job definitions from JSON, ensuring uniqueness and limits."""
    MAX_JOBS = 50
    if len(custom_jobs) > MAX_JOBS:
        raise ValueError(f"Too many jobs: maximum allowed is {MAX_JOBS}.")
    ids = [job.get("id") for job in custom_jobs]
    if len(ids) != len(set(ids)):
        raise ValueError("All custom job IDs must be unique.")
    jobs = []
    for job_data in custom_jobs:
        try:
            job = Job(
                id=job_data["id"],
                arrival_time=float(job_data["arrival_time"]),
                duration=float(job_data["duration"]),
                remaining_time=float(job_data["duration"]),
                priority=float(job_data.get("priority", 0.5)),
                requires_gpu=bool(job_data.get("requires_gpu", False)),
                deadline=float(job_data["deadline"]) if job_data.get("deadline") else None,
                owner=job_data.get("owner", "default")
            )
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError(f"Invalid job definition: {job_data}. Error: {e}")
        jobs.append(job)
    return jobs


def _generate_from_form(config: dict) -> List[Job]:
    """Generate jobs from form configuration."""
    n = config["total_jobs"]
    window = config["simulation_window"] * 1000  # convert to ms
    
    # 1. Generate arrival times
    arrival_times = _generate_arrivals(
        pattern=config["arrival_pattern"],
        n=n,
        rate=config["arrival_rate"],
        window=window
    )
    
    # 2. Generate durations
    durations = _generate_durations(
        n=n,
        min_ms=config["duration_min"],
        max_ms=config["duration_max"],
        variance=config["duration_variance"]
    )
    
    # 3. Assign priorities
    priorities = _generate_priorities(n, config["priority_spread"])
    
    # 4. Assign GPU requirements
    gpu_mask = np.random.rand(n) < (config["pct_gpu_jobs"] / 100)
    
    # 5. Assign deadlines
    deadline_mask = np.random.rand(n) < (config["pct_with_deadlines"] / 100)
    tightness = config["deadline_tightness"]
    
    jobs = []
    for i in range(n):
        deadline = None
        if deadline_mask[i]:
            deadline = arrival_times[i] + durations[i] * tightness
        
        jobs.append(Job(
            id=f"job-{i+1}",
            arrival_time=float(arrival_times[i]),
            duration=float(durations[i]),
            remaining_time=float(durations[i]),
            priority=float(priorities[i]),
            requires_gpu=bool(gpu_mask[i]),
            deadline=float(deadline) if deadline is not None else None,
            owner="default"
        ))
    
    return jobs


def _generate_arrivals(pattern, n, rate, window):
    """Generate arrival times based on the selected pattern."""
    if pattern == "poisson":
        inter_arrivals = np.random.exponential(1000 / rate, n)
        return np.cumsum(inter_arrivals)
    elif pattern == "periodic":
        interval = 1000 / rate
        return np.arange(n) * interval
    elif pattern == "uniform":
        return np.linspace(0, window, n)
    elif pattern == "bursty":
        times = []
        t = 0
        burst_duration = 10000  # 10s burst
        quiet_duration = 30000  # 30s quiet
        while len(times) < n:
            # Burst phase
            burst_end = t + burst_duration
            while t < burst_end and len(times) < n:
                t += np.random.exponential(1000 / (rate * 5))
                times.append(t)
            # Quiet phase
            quiet_end = t + quiet_duration
            while t < quiet_end and len(times) < n:
                t += np.random.exponential(1000 / max(rate * 0.2, 0.1))
                times.append(t)
        return np.array(times[:n])
    else:
        # Default to uniform
        return np.linspace(0, window, n)


def _generate_durations(n, min_ms, max_ms, variance):
    """Generate job durations with specified variance."""
    if variance > 5:
        # Pareto heavy tail
        alpha = 1.0 + (10 - variance) * 0.3
        samples = (np.random.pareto(alpha, n) + 1) * min_ms
    else:
        # Log-Normal
        mean = (min_ms + max_ms) / 2
        sigma = variance * 0.3
        samples = np.random.lognormal(np.log(mean), sigma, n)
    
    return np.clip(samples, min_ms, max_ms)


def _generate_priorities(n, spread):
    """Generate priorities using Beta distribution."""
    if spread == 1:
        return np.full(n, 0.5)
    a = 5.0 / spread
    return np.random.beta(a, a, n)
