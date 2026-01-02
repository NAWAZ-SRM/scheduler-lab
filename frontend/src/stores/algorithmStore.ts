import { create } from 'zustand';
import { AlgorithmSelection, Algorithm, CustomScheduler } from '../types/index';

// Predefined algorithms with their configurations
const ALGORITHMS: Record<string, Algorithm> = {
  fcfs: {
    id: 'fcfs',
    name: 'FCFS',
    description: 'First Come First Served - Simple and fair, processes jobs in arrival order',
    strength: ['Simple', 'Fair', 'No starvation'],
    weakness: ['Convoy effect', 'Long wait times', 'Priority insensitive'],
  },
  sjf: {
    id: 'sjf',
    name: 'SJF',
    description: 'Shortest Job First - Minimizes average wait time, non-preemptive',
    strength: ['Minimizes avg wait', 'Good throughput'],
    weakness: ['Prefers short jobs', 'Can cause starvation', 'Needs job duration knowledge'],
  },
  srpt: {
    id: 'srpt',
    name: 'SRPT',
    description: 'Shortest Remaining Processing Time - Preemptive SJF variant',
    strength: ['Minimizes avg wait', 'Better responsiveness'],
    weakness: ['Preemption overhead', 'Starvation risk', 'Unfair to long jobs'],
    params: {
      starvation_guard: { label: 'Starvation Guard (s)', min: 0, max: 60, default: 0 },
    },
  },
  edf: {
    id: 'edf',
    name: 'EDF',
    description: 'Earliest Deadline First - Prioritizes jobs by deadline',
    strength: ['Deadline aware', 'Optimal for hard deadlines'],
    weakness: ['Degrades when overloaded', 'Complex to implement'],
    params: {
      slack_threshold: { label: 'Slack Threshold (%)', min: 0, max: 80, default: 0 },
      non_deadline_weight: { label: 'Non-deadline Weight', min: 0, max: 1, default: 0.5 },
    },
  },
  rr: {
    id: 'rr',
    name: 'Round Robin',
    description: 'Round Robin - Time-slice based scheduling',
    strength: ['Fair', 'Responsive', 'No starvation'],
    weakness: ['Context switch overhead', 'Dependent on quantum'],
    params: {
      quantum: { label: 'Time Quantum (ms)', min: 10, max: 1000, default: 50 },
      priority_boost: { label: 'Priority Boost (x)', min: 1, max: 3, default: 1 },
    },
  },
  cfs: {
    id: 'cfs',
    name: 'CFS',
    description: 'Completely Fair Scheduler - Ensures fair CPU share',
    strength: ['Fair CPU share', 'Good scalability', 'Modern approach'],
    weakness: ['Higher avg latency', 'Needs owner info'],
    params: {
      min_granularity: { label: 'Min Granularity (ms)', min: 1, max: 100, default: 4 },
      latency_target: { label: 'Latency Target (ms)', min: 10, max: 500, default: 48 },
    },
  },
};

const STARTER_TEMPLATE = `function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;
  
  // Example: pick the job with highest priority
  return readyJobs.reduce((best, job) =>
    job.priority > best.priority ? job : best
  );
}`;

export interface FusionConfig {
  id: string;
  name: string;
  algorithms: string[];
  rule: 'priority' | 'duration' | 'deadline' | 'gpu';
  threshold?: number;
}

interface AlgorithmStoreState {
  selectedAlgorithms: AlgorithmSelection[];
  algorithms: Record<string, Algorithm>;
  
  // Custom Scheduler
  customScheduler: {
    code: string;
    name: string;
    isPreemptive: boolean;
    savedId: string | null;
    isEditing: boolean;
    validationErrors: Array<{ message: string; line?: number }>;
    isValid: boolean;
  };
  savedSchedulers: CustomScheduler[];
  
  // Algorithm Fusion
  fusionConfigs: FusionConfig[];
  isFusing: boolean;
  
  // Actions
  addAlgorithm: (algorithmId: string) => void;
  removeAlgorithm: (algorithmId: string) => void;
  updateAlgorithmParams: (algorithmId: string, params: Record<string, number>) => void;
  clearAlgorithms: () => void;
  getSelectedCount: () => number;
  canAddMore: () => boolean;
  getAlgorithmById: (id: string) => Algorithm | undefined;
  getSelectedAlgorithmDetails: () => Array<Algorithm & { selection: AlgorithmSelection }>;
  
  // Custom Scheduler Actions
  setCustomCode: (code: string) => void;
  setCustomName: (name: string) => void;
  setCustomPreemptive: (isPreemptive: boolean) => void;
  setCustomEditing: (isEditing: boolean) => void;
  loadSavedScheduler: (scheduler: CustomScheduler) => void;
  setSavedSchedulers: (schedulers: CustomScheduler[]) => void;
  resetCustomScheduler: () => void;
  setValidationResult: (errors: Array<{ message: string; line?: number }>, isValid: boolean) => void;
  
  // Fusion Actions
  addFusion: (fusion: FusionConfig) => void;
  removeFusion: (fusionId: string) => void;
  setFusing: (isFusing: boolean) => void;
  selectFusion: (fusionId: string) => void;
}

export const useAlgorithmStore = create<AlgorithmStoreState>((set, get) => ({
  selectedAlgorithms: [],
  algorithms: ALGORITHMS,
  
  // Custom Scheduler State
  customScheduler: {
    code: STARTER_TEMPLATE,
    name: 'My Custom Scheduler',
    isPreemptive: false,
    savedId: null,
    isEditing: false,
    validationErrors: [],
    isValid: true,
  },
  savedSchedulers: [],
  
  // Algorithm Fusion
  fusionConfigs: [],
  isFusing: false,

  addAlgorithm: (algorithmId: string) => {
    const state = get();
    // Max 3 algorithms can be selected
    if (state.selectedAlgorithms.length >= 3) {
      return;
    }
    // Don't add duplicates
    if (state.selectedAlgorithms.some(s => s.id === algorithmId)) {
      return;
    }
    const algorithm = ALGORITHMS[algorithmId];
    if (!algorithm) return;

    const defaultParams: Record<string, number> = {};
    if (algorithm.params) {
      Object.entries(algorithm.params).forEach(([key, config]) => {
        defaultParams[key] = config.default;
      });
    }

    set(state => ({
      selectedAlgorithms: [
        ...state.selectedAlgorithms,
        {
          id: algorithmId,
          params: defaultParams,
        },
      ],
    }));
  },

  removeAlgorithm: (algorithmId: string) => {
    set(state => ({
      selectedAlgorithms: state.selectedAlgorithms.filter(a => a.id !== algorithmId),
    }));
  },

  updateAlgorithmParams: (algorithmId: string, params: Record<string, number>) => {
    set(state => ({
      selectedAlgorithms: state.selectedAlgorithms.map(a =>
        a.id === algorithmId ? { ...a, params } : a
      ),
    }));
  },

  clearAlgorithms: () => {
    set({ selectedAlgorithms: [] });
  },

  getSelectedCount: () => {
    return get().selectedAlgorithms.length;
  },

  canAddMore: () => {
    return get().selectedAlgorithms.length < 3;
  },

  getAlgorithmById: (id: string) => {
    return ALGORITHMS[id];
  },

  getSelectedAlgorithmDetails: () => {
    const state = get();
    return state.selectedAlgorithms.map(selection => {
      const algorithm = ALGORITHMS[selection.id];
      return {
        ...algorithm,
        selection,
      };
    });
  },
  
  // Custom Scheduler Actions
  setCustomCode: (code: string) => {
    set(state => ({
      customScheduler: { ...state.customScheduler, code }
    }));
  },
  
  setCustomName: (name: string) => {
    set(state => ({
      customScheduler: { ...state.customScheduler, name }
    }));
  },
  
  setCustomPreemptive: (isPreemptive: boolean) => {
    set(state => ({
      customScheduler: { ...state.customScheduler, isPreemptive }
    }));
  },
  
  setCustomEditing: (isEditing: boolean) => {
    set(state => ({
      customScheduler: { ...state.customScheduler, isEditing }
    }));
  },
  
  loadSavedScheduler: (scheduler: CustomScheduler) => {
    set({
      customScheduler: {
        code: scheduler.code,
        name: scheduler.name,
        isPreemptive: scheduler.is_preemptive,
        savedId: scheduler.id,
        isEditing: false,
        validationErrors: [],
        isValid: true,
      }
    });
  },
  
  setSavedSchedulers: (schedulers: CustomScheduler[]) => {
    set({ savedSchedulers: schedulers });
  },
  
  resetCustomScheduler: () => {
    set({
      customScheduler: {
        code: STARTER_TEMPLATE,
        name: 'My Custom Scheduler',
        isPreemptive: false,
        savedId: null,
        isEditing: false,
        validationErrors: [],
        isValid: true,
      }
    });
  },
  
  setValidationResult: (errors, isValid) => {
    set(state => ({
      customScheduler: { 
        ...state.customScheduler, 
        validationErrors: errors,
        isValid 
      }
    }));
  },
  
  // Fusion Actions
  addFusion: (fusion: FusionConfig) => {
    set(state => ({
      fusionConfigs: [...state.fusionConfigs, fusion]
    }));
  },
  
  removeFusion: (fusionId: string) => {
    set(state => ({
      fusionConfigs: state.fusionConfigs.filter(f => f.id !== fusionId)
    }));
  },
  
  setFusing: (isFusing: boolean) => {
    set({ isFusing: isFusing });
  },
  
  selectFusion: (fusionId: string) => {
    const fusion = get().fusionConfigs.find(f => f.id === fusionId);
    if (!fusion) return;
    
    // Add each algorithm from the fusion
    fusion.algorithms.forEach(algoId => {
      if (get().selectedAlgorithms.length < 3) {
        get().addAlgorithm(algoId);
      }
    });
  },
}));
