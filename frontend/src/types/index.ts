// Auth Types
export interface User {
  id: string;
  username: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// Job Types
export interface Job {
  id: string;
  arrivalTime: number;
  duration: number;
  remainingTime: number;
  priority: number;
  requiresGpu: boolean;
  deadline: number | null;
  owner: string;
  waitTime: number;
  startTime: number | null;
  preemptCount: number;
}

// Cluster Types
export interface Cluster {
  totalSlots: number;
  freeSlots: number;
  totalGpuSlots: number;
  freeGpuSlots: number;
}

// Workload Configuration
export interface WorkloadConfig {
  source: 'form' | 'json';
  preset?: string;
  total_jobs: number;
  arrival_pattern: 'poisson' | 'bursty' | 'periodic' | 'uniform';
  arrival_rate: number;
  simulation_window: number;
  duration_min: number;
  duration_max: number;
  duration_variance: number;
  pct_with_deadlines: number;
  deadline_tightness: number;
  pct_gpu_jobs: number;
  priority_spread: number;
  cluster_slots: number;
  cluster_gpu_slots: number;
  custom_jobs?: any[] | null;
}

// Algorithm Types
export interface AlgorithmParams {
  [key: string]: number;
}

export interface AlgorithmSelection {
  id: string;
  params: AlgorithmParams;
}

export interface FusionConfig {
  name: string;
  algorithms: string[];
  rule: 'priority' | 'duration' | 'deadline' | 'gpu';
  threshold?: number;
}

export interface Algorithm {
  id: string;
  name: string;
  description: string;
  strength: string[];
  weakness: string[];
  params?: { [key: string]: { label: string; min: number; max: number; default: number } };
}

// Metrics
export interface SimulationMetrics {
  p50_latency: number;
  p95_latency: number;
  p99_latency: number;
  throughput: number;
  fairness_index: number;
  deadline_miss_rate: number;
  total_jobs: number;
  completed_jobs: number;
  starved_jobs: number;
  total_preemptions: number;
  avg_queue_depth: number;
}

// Gantt Data
export interface JobSegment {
  start: number;
  end: number;
  slot: number;
}

export interface GanttJob {
  id: string;
  owner: string;
  priority: number;
  arrival_time: number;
  deadline: number | null;
  segments: JobSegment[];
  completed_at: number;
  missed_deadline: boolean;
  was_starving: boolean;
}

export interface GanttData {
  slots: number;
  simulation_duration: number;
  jobs: GanttJob[];
}

// Series Data for Charts
export interface QueueDepthPoint {
  time: number;
  depth: number;
}

export interface UtilizationPoint {
  time: number;
  slots_used: number;
  gpu_used: number;
}

// Simulation Result
export interface SimulationResult {
  algo: string;
  algo_name: string;
  params: AlgorithmParams;
  metrics: SimulationMetrics;
  gantt_data: GanttData;
  queue_depth_series: QueueDepthPoint[];
  utilization_series: UtilizationPoint[];
}

// Simulation Run
export interface SimulationRun {
  id: string;
  name: string;
  user_id: string;
  workload_config: WorkloadConfig;
  algorithms_config: AlgorithmSelection[];
  results: SimulationResult[];
  share_token: string;
  created_at: string;
}

// API Request/Response Types
export interface SimulationRunRequest {
  workload: WorkloadConfig;
  algorithms: AlgorithmSelection[];
  fusion?: FusionConfig;
  global_params: {
    starvation_threshold: number;
    preemption_cost: number;
  };
}

export interface SimulationRunResponse {
  run_token: string;
}

export interface SaveRunRequest {
  name: string;
  run_token: string;
}

export interface SaveRunResponse {
  id: string;
  share_token: string;
}

export interface ListSimulationsResponse {
  runs: Array<{
    id: string;
    name: string;
    algorithms: string[];
    preset: string;
    primary_p95: number;
    primary_throughput: number;
    created_at: string;
    share_token: string;
  }>;
  total: number;
  page: number;
  pages: number;
}

// Custom Scheduler
export interface CustomScheduler {
  id: string;
  name: string;
  code: string;
  is_preemptive: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ValidateSchedulerRequest {
  code: string;
}

export interface ValidateSchedulerResponse {
  valid: boolean;
  errors: Array<{ message: string; line?: number }>;
}

// Global Params
export interface GlobalParams {
  starvation_threshold: number;
  preemption_cost: number;
}

// UI State
export interface UIState {
  selectedAlgorithms: string[];
  globalParams: GlobalParams;
  customSchedulerCode: string;
  customSchedulerName: string;
}
