import { create } from 'zustand';
import { User, AuthResponse } from '../types';
import * as api from '../api';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  signup: (username: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromToken: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  signup: async (username: string, email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response: AuthResponse = await api.signup(username, email, password);
      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      set({ user: response.user, isAuthenticated: true, loading: false });
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Signup failed';
      set({ error: errorMessage, loading: false });
      throw err;
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response: AuthResponse = await api.login(email, password);
      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      set({ user: response.user, isAuthenticated: true, loading: false });
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Login failed';
      set({ error: errorMessage, loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },

  loadFromToken: async () => {
    set({ loading: true });
    try {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('user');

      if (!token || !userStr) {
        set({ loading: false, user: null, isAuthenticated: false });
        return;
      }

      // Verify token is still valid
      const user = await api.getMe();
      set({ user, isAuthenticated: true, loading: false });
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
