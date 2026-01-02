import client from './client';
import {
  AuthResponse,
  User,
  SimulationRunRequest,
  SimulationRunResponse,
  SaveRunRequest,
  SaveRunResponse,
  SimulationResult,
  ListSimulationsResponse,
  SimulationRun,
  CustomScheduler,
  ValidateSchedulerRequest,
  ValidateSchedulerResponse,
} from '../types';

// ==================== AUTH ====================

export async function signup(
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await client.post<AuthResponse>('/auth/signup', {
    username,
    email,
    password,
  });
  return response.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await client.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await client.get<User>('/auth/me');
  return response.data;
}

// ==================== SIMULATIONS ====================

export async function runSimulation(config: SimulationRunRequest): Promise<SimulationRunResponse> {
  const response = await client.post<SimulationRunResponse>('/simulations/run', config);
  return response.data;
}

export function streamSimulation(
  runToken: string,
  handlers: {
    onProgress: (percent: number, message: string) => void;
    onComplete: (results: SimulationResult[]) => void;
    onError: (message: string) => void;
  }
): () => void {
  const source = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/simulations/stream/${runToken}`);

  source.addEventListener('progress', (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    handlers.onProgress(data.percent, data.message);
  });

  source.addEventListener('complete', (event: MessageEvent) => {
    const results = JSON.parse(event.data);
    handlers.onComplete(results);
    source.close();
  });

  source.addEventListener('error', (event: Event) => {
    if (source.readyState === EventSource.CLOSED) {
      handlers.onError('Connection closed');
    } else {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        handlers.onError(data?.message || 'Simulation error');
      } catch {
        handlers.onError('Unknown error occurred');
      }
    }
    source.close();
  });

  return () => source.close();
}

export async function saveSimulation(request: SaveRunRequest): Promise<SaveRunResponse> {
  const response = await client.post<SaveRunResponse>('/simulations/save', request);
  return response.data;
}

export async function listSimulations(page = 1, limit = 20): Promise<ListSimulationsResponse> {
  const response = await client.get<ListSimulationsResponse>('/simulations', {
    params: { page, limit },
  });
  return response.data;
}

export async function getSimulation(runId: string): Promise<SimulationRun> {
  const response = await client.get<SimulationRun>(`/simulations/${runId}`);
  return response.data;
}

export async function deleteSimulation(runId: string): Promise<void> {
  await client.delete(`/simulations/${runId}`);
}

export async function getSharedSimulation(shareToken: string): Promise<SimulationRun> {
  const response = await client.get<SimulationRun>(`/simulations/shared/${shareToken}`);
  return response.data;
}

// ==================== CUSTOM SCHEDULERS ====================

export async function listSchedulers(): Promise<{ schedulers: CustomScheduler[] }> {
  const response = await client.get<{ schedulers: CustomScheduler[] }>('/schedulers');
  return response.data;
}

export async function createScheduler(
  name: string,
  code: string,
  is_preemptive: boolean
): Promise<CustomScheduler> {
  const response = await client.post<CustomScheduler>('/schedulers', {
    name,
    code,
    is_preemptive,
  });
  return response.data;
}

export async function updateScheduler(
  schedulerId: string,
  name: string,
  code: string,
  is_preemptive: boolean
): Promise<CustomScheduler> {
  const response = await client.put<CustomScheduler>(`/schedulers/${schedulerId}`, {
    name,
    code,
    is_preemptive,
  });
  return response.data;
}

export async function deleteScheduler(schedulerId: string): Promise<void> {
  await client.delete(`/schedulers/${schedulerId}`);
}

export async function validateScheduler(
  request: ValidateSchedulerRequest
): Promise<ValidateSchedulerResponse> {
  const response = await client.post<ValidateSchedulerResponse>('/schedulers/validate', request);
  return response.data;
}
