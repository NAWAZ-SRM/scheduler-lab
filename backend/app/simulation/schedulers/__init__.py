from .fcfs import schedule as fcfs_schedule
from .sjf import schedule as sjf_schedule
from .srpt import make_srpt
from .edf import make_edf
from .rr import make_rr
from .cfs import make_cfs
from .fusion import make_fusion_scheduler, FusionScheduler
from ..js_sandbox import make_js_scheduler


def get_scheduler(algo_config: dict, global_params: dict, fusion_config: dict = None):
    """
    Get a scheduler function based on algorithm configuration.
    
    Args:
        algo_config: Algorithm configuration dict
        global_params: Global scheduling parameters
        fusion_config: Optional fusion configuration
    
    Returns:
        Scheduler function
    """
    # If fusion config is provided, create a fusion scheduler FIRST
    if fusion_config and fusion_config.get("algorithms"):
        return make_fusion_scheduler(
            algorithm_configs=[{"id": algo_id, "params": {}} for algo_id in fusion_config["algorithms"]],
            fusion_config=fusion_config,
            global_params=global_params
        )
    
    algo_id = algo_config.get("id")
    params = algo_config.get("params", {})
    
    dispatch = {
        "fcfs": lambda: fcfs_schedule,
        "sjf": lambda: sjf_schedule,
        "srpt": lambda: make_srpt(params),
        "edf": lambda: make_edf(params),
        "rr": lambda: make_rr(params),
        "cfs": lambda: make_cfs(params),
    }
    
    if algo_id in dispatch:
        return dispatch[algo_id]()
    
    if algo_id == "custom":
        code = algo_config.get("code", "")
        return make_js_scheduler(code, params)
    
    raise ValueError(f"Unknown algorithm: {algo_id}")
