def make_cfs(params):
    min_gran = params.get("min_granularity", 4)
    vruntime = {}  # owner -> accumulated virtual runtime
    
    def schedule(ready_jobs, running_jobs, cluster, now):
        nonlocal vruntime
        
        # Update vruntime for running jobs
        for rj in running_jobs:
            elapsed = now - (getattr(rj, 'last_cfs_update', now))
            w = max(rj.priority, 0.01)
            vruntime[rj.owner] = vruntime.get(rj.owner, 0) + elapsed / w
            rj.last_cfs_update = now
        
        min_vt = min(vruntime.values()) if vruntime else 0
        
        for job in ready_jobs:
            if job.owner not in vruntime:
                vruntime[job.owner] = min_vt
        
        if not ready_jobs:
            return None
        
        return min(ready_jobs, key=lambda j: vruntime[j.owner])
    
    schedule.preemptive = True
    return schedule
