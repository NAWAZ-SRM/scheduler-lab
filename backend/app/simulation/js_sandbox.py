import re
from typing import Callable, Dict, Any


from app.schemas.scheduler import ValidationResponse, ValidationError


# JavaScript patterns to block (security)
BLOCKED_PATTERNS = [
    (r'eval\s*\(', 'eval() is not allowed'),
    (r'new\s+Function', 'Function constructor is not allowed'),
    (r'while\s*\(\s*true\s*\)', 'Infinite loops are not allowed'),
    (r'for\s*\(\s*;\s*;\s*\)', 'Infinite loops are not allowed'),
    (r'fetch\s*\(', 'Network requests are not allowed'),
    (r'XMLHttpRequest', 'Network requests are not allowed'),
    (r'WebSocket', 'Network requests are not allowed'),
    (r'require\s*\(', 'Module loading is not allowed'),
    (r'import\s*\(', 'Dynamic imports are not allowed'),
    (r'setTimeout', 'Timers are not allowed'),
    (r'setInterval', 'Timers are not allowed'),
    (r'window\s*\.\s*', 'Access to window is not allowed'),
    (r'document\s*\.\s*', 'Access to document is not allowed'),
    (r'process\s*\.\s*', 'Access to process is not allowed'),
    (r'global\s*\.\s*', 'Access to global is not allowed'),
]


def validate_js_code(code: str) -> ValidationResponse:
    """
    Validate JavaScript code for security issues.
    Returns ValidationResponse with valid status and any errors.
    """
    errors = []
    
    # Check for blocked patterns with regex
    for pattern, message in BLOCKED_PATTERNS:
        matches = list(re.finditer(pattern, code, re.IGNORECASE))
        for match in matches:
            line = code[:match.start()].count('\n') + 1
            errors.append(ValidationError(message=message, line=line))
    
    # Parse AST to find unbounded loops
    try:
        try:
            import esprima
        except ImportError:
            errors.append(ValidationError(message="esprima (JS parser) is not installed on the backend.", line=None))
            return ValidationResponse(valid=False, errors=errors)
        tree = esprima.parseScript(code, tolerant=True, loc=True)
    except Exception as e:
        errors.append(ValidationError(message=f"Syntax error: {str(e)}", line=None))
        return ValidationResponse(valid=False, errors=errors)
    
    # Check for while(true) and for(;;) via AST
    def check_node(node, depth=0):
        if depth > 100:  # Prevent stack overflow
            return
        
        if isinstance(node, dict):
            node_type = node.get('type', '')
            
            if node_type == 'WhileStatement':
                test = node.get('test', {})
                if test.get('type') == 'Literal' and test.get('value') is True:
                    loc = node.get('loc', {})
                    line = loc.get('start', {}).get('line', 1)
                    errors.append(ValidationError(
                        message="Infinite loops are not allowed",
                        line=line
                    ))
            
            elif node_type == 'ForStatement':
                # Check for empty for(;;)
                init = node.get('init')
                test = node.get('test')
                update = node.get('update')
                if init is None and test is None and update is None:
                    loc = node.get('loc', {})
                    line = loc.get('start', {}).get('line', 1)
                    errors.append(ValidationError(
                        message="Infinite loops are not allowed",
                        line=line
                    ))
            
            # Recurse
            for key, value in node.items():
                if key != 'loc':  # Skip location nodes
                    check_node(value, depth + 1)
        
        elif isinstance(node, list):
            for item in node:
                check_node(item, depth + 1)
    
    check_node(tree)
    
    # Check for schedule function
    if 'function schedule' not in code:
        errors.append(ValidationError(
            message="Code must define a function named 'schedule'",
            line=None
        ))
    
    if errors:
        return ValidationResponse(valid=False, errors=errors)
    
    return ValidationResponse(valid=True, errors=[])


def make_js_scheduler(code: str, params: Dict[str, Any]) -> Callable:
    """
    Wrap JavaScript scheduler code into a callable Python function.
    Uses PyMiniRacer for sandboxed execution.
    """
    # Create wrapper code that executes JS in sandbox
    wrapper_code = f"""
    {code}
    
    function invokeSchedule(readyJobs, runningJobs, cluster, now) {{
        try {{
            return schedule(readyJobs, runningJobs, cluster, now);
        }} catch (e) {{
            return null;
        }}
    }}
    
    invokeSchedule;
    """
    
    try:
        from py_mini_racer import MiniRacer
    except ImportError:
        raise RuntimeError("py_mini_racer (Javascript engine) is not installed on the backend.")
    ctx = MiniRacer()
    ctx.eval(wrapper_code)
    
    def schedule(ready_jobs, running_jobs, cluster, now):
        # Convert Python objects to JS-compatible dicts
        ready_list = list([
            {
                "id": j.id,
                "arrivalTime": j.arrival_time,
                "duration": j.duration,
                "remainingTime": j.remaining_time,
                "priority": j.priority,
                "requiresGpu": j.requires_gpu,
                "deadline": j.deadline,
                "owner": j.owner,
                "waitTime": j.wait_time,
                "startTime": j.start_time,
                "preemptCount": j.preempt_count
            }
            for j in ready_jobs
        ])
        
        running_list = list([
            {
                "id": j.id,
                "arrivalTime": j.arrival_time,
                "duration": j.duration,
                "remainingTime": j.remaining_time,
                "priority": j.priority,
                "requiresGpu": j.requires_gpu,
                "deadline": j.deadline,
                "owner": j.owner,
                "waitTime": j.wait_time,
                "startTime": j.start_time,
                "preemptCount": j.preempt_count
            }
            for j in running_jobs
        ])
        
        running_list = [
            {{
                "id": j.id,
                "arrivalTime": j.arrival_time,
                "duration": j.duration,
                "remainingTime": j.remaining_time,
                "priority": j.priority,
                "requiresGpu": j.requires_gpu,
                "deadline": j.deadline,
                "owner": j.owner,
                "waitTime": j.wait_time,
                "startTime": j.start_time,
                "preemptCount": j.preempt_count
            }}
            for j in running_jobs
        ]
        
        result = ctx.call('invokeSchedule', ready_list, running_list, cluster, now)
        
        if result is None:
            return None
        
        # Find the matching job in ready_jobs
        result_id = result.get('id') if isinstance(result, dict) else None
        for job in ready_jobs:
            if job.id == result_id:
                return job
        
        return None
    
    # Check if code declares schedule as preemptive
    setattr(schedule, "preemptive", 'schedule.preemptive = true' in code.lower())
    
    return schedule
