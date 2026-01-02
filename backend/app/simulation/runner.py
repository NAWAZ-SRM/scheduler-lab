import copy
from typing import Callable, List, Dict, Any, Optional
from .workload import generate_workload
from .simulator import Simulator
from .schedulers import get_scheduler


def run_simulation(
    workload_config: dict,
    algorithm_configs: List[dict],
    global_params: dict,
    progress_callback: Callable[[int, str], None],
    fusion_config: Optional[dict] = None
) -> List[dict]:
    """
    Run a simulation for each algorithm in algorithm_configs against the same workload.
    If fusion_config is provided, also run a fused scheduler.
    progress_callback(percent, message) is called at key milestones.
    Returns list of result dicts (one per algorithm).
    """
    progress_callback(10, "Generating workload...")
    jobs = generate_workload(workload_config)
    
    results = []
    
    # Calculate progress distribution
    total_runs = len(algorithm_configs)
    if fusion_config:
        total_runs += 1  # Add one more run for fusion
    
    for i, algo_config in enumerate(algorithm_configs):
        pct_start = 15 + (i * 60 // total_runs)
        pct_end = 15 + ((i + 1) * 60 // total_runs)
        
        progress_callback(pct_start, f"Running {algo_config['id'].upper()}...")
        
        # Get scheduler function
        scheduler_fn = get_scheduler(algo_config, global_params, fusion_config=None)
        
        # Run simulation (fresh copy of jobs for each algorithm)
        jobs_copy = copy.deepcopy(jobs)
        merged_params = dict(global_params)
        merged_params.setdefault("cluster_slots", workload_config.get("cluster_slots", 8))
        merged_params.setdefault("cluster_gpu_slots", workload_config.get("cluster_gpu_slots", 0))

        sim = Simulator(jobs_copy, scheduler_fn, merged_params)
        
        def on_event(n):
            progress_callback(
                pct_start + int((n / (len(jobs) * 3)) * (pct_end - pct_start)),
                f"Running {algo_config['id'].upper()} ({n} events)..."
            )
        
        sim_result = sim.run(on_event=on_event)
        
        # Add algorithm info
        sim_result["algo"] = algo_config["id"]
        sim_result["algo_name"] = algo_config["id"].upper()
        sim_result["params"] = algo_config.get("params", {})
        
        results.append(sim_result)
    
    # Run fusion if configured
    if fusion_config and fusion_config.get("algorithms"):
        pct_start = 15 + (len(algorithm_configs) * 60 // total_runs)
        pct_end = 80
        
        fusion_name = fusion_config.get("name", "Fused")
        progress_callback(pct_start, f"Running {fusion_name}...")
        
        # Create fusion scheduler with all the algorithms in the fusion
        fusion_algo_configs = [
            {"id": algo_id, "params": {}}
            for algo_id in fusion_config["algorithms"]
        ]
        
        scheduler_fn = get_scheduler(
            {"id": "fusion", "params": {}},
            global_params,
            fusion_config={
                "algorithms": fusion_config["algorithms"],
                "rule": fusion_config.get("rule", "duration"),
                "threshold": fusion_config.get("threshold", 500)
            }
        )
        
        # Run simulation with fusion scheduler
        jobs_copy = copy.deepcopy(jobs)
        merged_params = dict(global_params)
        merged_params.setdefault("cluster_slots", workload_config.get("cluster_slots", 8))
        merged_params.setdefault("cluster_gpu_slots", workload_config.get("cluster_gpu_slots", 0))
        
        sim = Simulator(jobs_copy, scheduler_fn, merged_params)
        
        def on_event_fusion(n):
            progress_callback(
                pct_start + int((n / (len(jobs) * 3)) * (pct_end - pct_start)),
                f"Running {fusion_name} ({n} events)..."
            )
        
        sim_result = sim.run(on_event=on_event_fusion)
        
        # Add fusion info
        sim_result["algo"] = "fusion"
        sim_result["algo_name"] = fusion_name
        sim_result["params"] = {
            "rule": fusion_config.get("rule", "duration"),
            "threshold": fusion_config.get("threshold", 500),
            "algorithms": fusion_config["algorithms"]
        }
        sim_result["is_fusion"] = True
        
        results.append(sim_result)
    
    progress_callback(90, "Computing metrics and building Gantt...")
    
    return results
