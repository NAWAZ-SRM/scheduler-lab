import { create } from 'zustand';
import { SimulationRun, SimulationRunRequest, SimulationResult } from '../types/index';
import * as api from '../api';

type SimulationStatus = 'idle' | 'running' | 'completed' | 'error';

interface SimulationStoreState {
  // Current simulation state
  currentRun: SimulationRun | null;
  currentRunToken: string | null;
  status: SimulationStatus;
  error: string | null;
  progress: number; // 0-100
  progressMessage: string;
  
  // Simulation history/list
  pastRuns: SimulationRun[];
  
  // Actions
  startSimulation: (request: SimulationRunRequest) => Promise<void>;
  setStatus: (status: SimulationStatus) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number, message?: string) => void;
  setCurrentRun: (run: SimulationRun | null) => void;
  addPastRun: (run: SimulationRun) => void;
  setPastRuns: (runs: SimulationRun[]) => void;
  clearCurrentRun: () => void;
  getSimulationById: (id: string) => SimulationRun | null;
}

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  currentRun: null,
  currentRunToken: null,
  status: 'idle',
  error: null,
  progress: 0,
  progressMessage: '',
  pastRuns: [],

  startSimulation: async (request: SimulationRunRequest) => {
    set({ status: 'running', error: null, progress: 0, progressMessage: 'Starting simulation...' });
    
    try {
      console.log('Starting simulation with request:', request);
      
      // Call the API to start the simulation
      const response = await api.runSimulation(request);
      const runToken = response.run_token;
      
      console.log('Simulation started with token:', runToken);
      
      // Stream the results using SSE
      const cleanup = api.streamSimulation(runToken, {
        onProgress: (percent, message) => {
          set({ progress: percent, progressMessage: message });
        },
        onComplete: (results: SimulationResult[]) => {
          console.log('Simulation completed with results:', results);
          set({ 
            status: 'completed', 
            progress: 100, 
            progressMessage: 'Simulation complete!',
            currentRun: {
              id: runToken,
              name: `Simulation ${new Date().toISOString()}`,
              user_id: '',
              workload_config: request.workload,
              algorithms_config: request.algorithms,
              results: results,
              share_token: '',
              created_at: new Date().toISOString(),
            }
          });
          cleanup();
        },
        onError: (message) => {
          console.error('Simulation error:', message);
          set({ status: 'error', error: message, progress: 0 });
          cleanup();
        }
      });
      
      // Store cleanup function for later
      set({ currentRunToken: runToken });
    } catch (err: any) {
      console.error('Failed to start simulation:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to start simulation';
      set({ status: 'error', error: errorMessage, progress: 0, progressMessage: '' });
    }
  },

  setStatus: (status: SimulationStatus) => {
    set({ status });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setProgress: (progress: number, message = '') => {
    set({ progress: Math.min(100, Math.max(0, progress)), progressMessage: message });
  },

  setCurrentRun: (run: SimulationRun | null) => {
    set({ currentRun: run });
  },

  addPastRun: (run: SimulationRun) => {
    set(state => ({
      pastRuns: [run, ...state.pastRuns],
    }));
  },

  setPastRuns: (runs: SimulationRun[]) => {
    set({ pastRuns: runs });
  },

  clearCurrentRun: () => {
    set({ currentRun: null, status: 'idle', error: null, progress: 0 });
  },

  getSimulationById: (id: string) => {
    const { currentRun, pastRuns } = get();
    if (currentRun?.id === id) return currentRun;
    return pastRuns.find(run => run.id === id) || null;
  },
}));

export const useSimulationSSE = (simulationId: string | null) => {
  if (!simulationId) return null;

  let eventSource: any = null;

  const subscribe = () => {
    // TODO: Connect to SSE endpoint
    // eventSource = new EventSource(`${API_URL}/api/simulations/${simulationId}/stream`);
    // eventSource.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   onProgress?.(data.progress);
    // };
  };

  const unsubscribe = () => {
    if (eventSource) {
      eventSource.close();
    }
  };

  return { subscribe, unsubscribe };
};
