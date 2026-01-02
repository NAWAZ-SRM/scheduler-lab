def make_srpt(params):
    starvation_guard_ms = params.get("starvation_guard", 0) * 1000
    
    def schedule(ready_jobs, running_jobs, cluster, now):
        if not ready_jobs:
            return None
        
        def eff(job):
            if starvation_guard_ms > 0 and job.wait_time > starvation_guard_ms:
                return job.remaining_time * 0.5
            return job.remaining_time
        
        return min(ready_jobs, key=eff)
    
    schedule.preemptive = True
    return schedule
