from typing import List, Dict, Any
from .job import Job


def build_gantt_data(completed: List[Job], total_slots: int, sim_duration: float,
                     starvation_threshold: float) -> dict:
    """
    Build the gantt_data structure from completed jobs.
    Each job's execution is represented as a list of segments
    (start, end, slot) - gaps between segments are preemption periods.
    """
    jobs_data = []
    for job in completed:
        # Ensure all segments have end times
        segments = []
        for seg in getattr(job, 'segments', []):
            if seg.get('end') is not None:
                segments.append({
                    "start": int(seg['start']),
                    "end": int(seg['end']),
                    "slot": seg['slot']
                })
        
        jobs_data.append({
            "id": job.id,
            "owner": job.owner,
            "priority": round(job.priority, 2),
            "arrival_time": int(job.arrival_time),
            "deadline": int(job.deadline) if job.deadline else None,
            "segments": segments,
            "completed_at": int(job.completion_time) if job.completion_time else None,
            "missed_deadline": job.missed_deadline,
            "was_starving": job.wait_time > starvation_threshold
        })
    
    return {
        "slots": total_slots,
        "simulation_duration": int(sim_duration),
        "jobs": jobs_data
    }
