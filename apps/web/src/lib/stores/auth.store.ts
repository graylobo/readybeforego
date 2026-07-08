import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api/auth';
import { User } from '@community/shared-types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: (force?: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  setAuth: (token: string, user: User) => {
    // We keep user in state for the current session.
    // Persistent auth is handled by the HttpOnly cookie.
    set({ user, isAuthenticated: true });
    
    if (typeof document !== 'undefined') {
      document.cookie = `user=${encodeURIComponent(
        JSON.stringify(user)
      )}; path=/; max-age=604800`;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error('Logout failed:', e);
    }
    set({ user: null, token: null, isAuthenticated: false });

    if (typeof document !== 'undefined') {
      document.cookie = 'user=; path=/; max-age=0';
    }
  },

  checkAuth: async (force = false) => {
    const { isLoading, isAuthenticated } = get();

    if (!force && isLoading) return;
    
    // If already authenticated and not forced, don't check again to save bandwidth
    if (isAuthenticated && !force) return;

    if (!force) set({ isLoading: true });
    
    try {
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, token: null, isAuthenticated: false });
    } finally {
      if (!force) set({ isLoading: false });
    }
  },
}));
