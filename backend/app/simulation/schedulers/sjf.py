def schedule(ready_jobs, running_jobs, cluster, now):
    if not ready_jobs:
        return None
    return min(ready_jobs, key=lambda j: j.duration)


schedule.preemptive = False
