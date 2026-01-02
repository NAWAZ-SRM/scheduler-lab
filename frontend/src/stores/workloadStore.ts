import { create } from 'zustand';
import { WorkloadConfig } from '../types';

interface WorkloadStore {
  // Form-based config
  preset: string;
  totalJobs: number;
  arrivalPattern: 'poisson' | 'bursty' | 'periodic' | 'uniform';
  arrivalRate: number;
  simulationWindow: number;
  durationMin: number;
  durationMax: number;
  durationVariance: number;
  pctWithDeadlines: number;
  deadlineTightness: number;
  pctGpuJobs: number;
  prioritySpread: number;
  clusterSlots: number;
  clusterGpuSlots: number;

  // Advanced mode
  useCustomJson: boolean;
  customJsonText: string;
  customJsonError: string | null;

  // Actions
  setPreset: (preset: string) => void;
  setField: (field: string, value: number | string) => void;
  setCustomJson: (json: string) => void;
  toggleCustomJson: () => void;
  buildWorkloadConfig: () => WorkloadConfig;
  resetToDefaults: (preset?: string) => void;
  clearJsonError: () => void;
}

const DEFAULT_PRESETS: Record<string, Partial<WorkloadStore>> = {
  web_api_server: {
    totalJobs: 200,
    arrivalPattern: 'poisson',
    arrivalRate: 20,
    simulationWindow: 120,
    durationMin: 10,
    durationMax: 2000,
    durationVariance: 7,
    pctWithDeadlines: 0,
    deadlineTightness: 2.0,
    pctGpuJobs: 0,
    prioritySpread: 1,
    clusterSlots: 8,
    clusterGpuSlots: 0,
  },
  ml_training_queue: {
    totalJobs: 30,
    arrivalPattern: 'periodic',
    arrivalRate: 1,
    simulationWindow: 600,
    durationMin: 1500,
    durationMax: 2100,
    durationVariance: 2,
    pctWithDeadlines: 0,
    deadlineTightness: 2.0,
    pctGpuJobs: 70,
    prioritySpread: 1,
    clusterSlots: 8,
    clusterGpuSlots: 4,
  },
  video_transcoding: {
    totalJobs: 80,
    arrivalPattern: 'bursty',
    arrivalRate: 10,
    simulationWindow: 300,
    durationMin: 80,
    durationMax: 400,
    durationVariance: 5,
    pctWithDeadlines: 60,
    deadlineTightness: 3.0,
    pctGpuJobs: 0,
    prioritySpread: 2,
    clusterSlots: 8,
    clusterGpuSlots: 0,
  },
  mixed_workload: {
    totalJobs: 150,
    arrivalPattern: 'poisson',
    arrivalRate: 15,
    simulationWindow: 300,
    durationMin: 50,
    durationMax: 1500,
    durationVariance: 6,
    pctWithDeadlines: 30,
    deadlineTightness: 2.5,
    pctGpuJobs: 20,
    prioritySpread: 3,
    clusterSlots: 8,
    clusterGpuSlots: 2,
  },
  stress_test: {
    totalJobs: 500,
    arrivalPattern: 'poisson',
    arrivalRate: 50,
    simulationWindow: 120,
    durationMin: 50,
    durationMax: 500,
    durationVariance: 3,
    pctWithDeadlines: 80,
    deadlineTightness: 1.5,
    pctGpuJobs: 0,
    prioritySpread: 2,
    clusterSlots: 16,
    clusterGpuSlots: 0,
  },
  custom: {
    totalJobs: 50,
    arrivalPattern: 'poisson',
    arrivalRate: 10,
    simulationWindow: 120,
    durationMin: 100,
    durationMax: 500,
    durationVariance: 3,
    pctWithDeadlines: 0,
    deadlineTightness: 2.0,
    pctGpuJobs: 0,
    prioritySpread: 1,
    clusterSlots: 8,
    clusterGpuSlots: 0,
  },
};

export const useWorkloadStore = create<WorkloadStore>((set, get) => {
  const customPreset = DEFAULT_PRESETS.custom!;
  
  return {
    preset: 'custom',
    totalJobs: customPreset.totalJobs || 50,
    arrivalPattern: (customPreset.arrivalPattern || 'poisson') as any,
    arrivalRate: customPreset.arrivalRate || 10,
    simulationWindow: customPreset.simulationWindow || 120,
    durationMin: customPreset.durationMin || 100,
    durationMax: customPreset.durationMax || 500,
    durationVariance: customPreset.durationVariance || 3,
    pctWithDeadlines: customPreset.pctWithDeadlines || 0,
    deadlineTightness: customPreset.deadlineTightness || 2.0,
    pctGpuJobs: customPreset.pctGpuJobs || 0,
    prioritySpread: customPreset.prioritySpread || 1,
    clusterSlots: customPreset.clusterSlots || 8,
    clusterGpuSlots: customPreset.clusterGpuSlots || 0,
    useCustomJson: false,
    customJsonText: '',
    customJsonError: null,

    setPreset: (preset: string) => {
      const presetConfig = DEFAULT_PRESETS[preset];
      if (presetConfig) {
        set({
          preset,
          totalJobs: presetConfig.totalJobs!,
          arrivalPattern: presetConfig.arrivalPattern as any,
          arrivalRate: presetConfig.arrivalRate!,
          simulationWindow: presetConfig.simulationWindow!,
          durationMin: presetConfig.durationMin!,
          durationMax: presetConfig.durationMax!,
          durationVariance: presetConfig.durationVariance!,
          pctWithDeadlines: presetConfig.pctWithDeadlines!,
          deadlineTightness: presetConfig.deadlineTightness!,
          pctGpuJobs: presetConfig.pctGpuJobs!,
          prioritySpread: presetConfig.prioritySpread!,
          clusterSlots: presetConfig.clusterSlots!,
          clusterGpuSlots: presetConfig.clusterGpuSlots!,
        });
      }
    },

    setField: (field: string, value: number | string) => {
      set((state) => ({
        ...state,
        [field]: value,
      }));
    },

    setCustomJson: (json: string) => {
      try {
        JSON.parse(json);
        set({ customJsonText: json, customJsonError: null });
      } catch (err: any) {
        set({ customJsonError: err.message });
      }
    },

    toggleCustomJson: () => {
      set((state) => ({
        useCustomJson: !state.useCustomJson,
        customJsonError: null,
      }));
    },

    buildWorkloadConfig: (): WorkloadConfig => {
      const state = get();
      
      if (state.useCustomJson) {
        try {
          const jobs = JSON.parse(state.customJsonText);
          return {
            source: 'json',
            total_jobs: jobs.length,
            arrival_pattern: 'poisson',
            arrival_rate: 10,
            simulation_window: 120,
            duration_min: 100,
            duration_max: 500,
            duration_variance: 3,
            pct_with_deadlines: 0,
            deadline_tightness: 2.0,
            pct_gpu_jobs: 0,
            priority_spread: 1,
            cluster_slots: state.clusterSlots,
            cluster_gpu_slots: state.clusterGpuSlots,
            custom_jobs: jobs,
          };
        } catch {
          throw new Error('Invalid custom jobs JSON');
        }
      }

      return {
        source: 'form',
        preset: state.preset,
        total_jobs: state.totalJobs,
        arrival_pattern: state.arrivalPattern,
        arrival_rate: state.arrivalRate,
        simulation_window: state.simulationWindow,
        duration_min: state.durationMin,
        duration_max: state.durationMax,
        duration_variance: state.durationVariance,
        pct_with_deadlines: state.pctWithDeadlines,
        deadline_tightness: state.deadlineTightness,
        pct_gpu_jobs: state.pctGpuJobs,
        priority_spread: state.prioritySpread,
        cluster_slots: state.clusterSlots,
        cluster_gpu_slots: state.clusterGpuSlots,
        custom_jobs: null,
      };
    },

    resetToDefaults: (preset = 'custom') => {
      get().setPreset(preset);
    },

    clearJsonError: () => set({ customJsonError: null }),
  };
});
