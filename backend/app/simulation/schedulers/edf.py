def make_edf(params):
    slack_threshold = params.get("slack_threshold", 0) / 100
    no_dl_weight = params.get("non_deadline_weight", 0.5)
    
    def schedule(ready_jobs, running_jobs, cluster, now):
        if not ready_jobs:
            return None
        
        def urgency(job):
            if job.deadline is None:
                return float('inf') * (2 - no_dl_weight)
            ttd = job.deadline - now
            if slack_threshold > 0:
                slack_ratio = (ttd - job.remaining_time) / max(ttd, 1)
                if slack_ratio < slack_threshold:
                    return float('inf')
            return ttd
        
        return min(ready_jobs, key=urgency)
    
    schedule.preemptive = True
    return schedule
