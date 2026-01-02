def make_rr(params):
    quantum = params.get("time_quantum", 50)
    priority_boost = params.get("priority_boost", 1)
    rr_order = []  # Maintains circular order
    
    def schedule(ready_jobs, running_jobs, cluster, now):
        nonlocal rr_order
        current_ids = {j.id for j in ready_jobs}
        rr_order = [j for j in rr_order if j.id in current_ids]
        
        for job in ready_jobs:
            if not any(j.id == job.id for j in rr_order):
                rr_order.append(job)
        
        if not rr_order:
            return None
        
        return rr_order[0]
    
    schedule.preemptive = False
    schedule.time_quantum = quantum
    return schedule
