import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api/auth';
import { User } from '@community/shared-types';
import { emitAuthIdentityChange } from '@/lib/stores/auth.events';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** 로그인 확인(checkAuth)을 한 번이라도 마쳤는지. 처음 화면에서는 user가 null이어도 '비로그인'인지 '아직 모름'인지 구분해야 한다 */
  authChecked: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: (force?: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  authChecked: false,

  setAuth: (token: string, user: User) => {
    emitAuthIdentityChange(true);
    set({ user, isAuthenticated: true, authChecked: true });
    
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
    emitAuthIdentityChange(false);

    if (typeof document !== 'undefined') {
      document.cookie = 'user=; path=/; max-age=0';
    }
  },

  checkAuth: async (force = false) => {
    const { isLoading, isAuthenticated } = get();

    if (!force && isLoading) return;
    
    if (isAuthenticated && !force) return;

    if (!force) set({ isLoading: true });
    
    try {
      const user = await authApi.getMe();
      emitAuthIdentityChange(true);
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, token: null, isAuthenticated: false });
    } finally {
      set({ authChecked: true, ...(!force && { isLoading: false }) });
    }
  },
}));
