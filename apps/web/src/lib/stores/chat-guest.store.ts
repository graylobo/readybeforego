import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function peekGuestIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { gid?: string };
    return typeof payload.gid === 'string' ? payload.gid : null;
  } catch {
    return null;
  }
}

interface ChatGuestState {
  token: string | null;
  nickname: string | null;
  guestId: string | null;
  hasHydrated: boolean;
  setGuest: (token: string, nickname: string, guestId?: string | null) => void;
  clearGuest: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useChatGuestStore = create<ChatGuestState>()(
  persist(
    (set) => ({
      token: null,
      nickname: null,
      guestId: null,
      hasHydrated: false,
      setGuest: (token, nickname, guestId) =>
        set({
          token,
          nickname,
          guestId: guestId || peekGuestIdFromToken(token),
        }),
      clearGuest: () => set({ token: null, nickname: null, guestId: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'community-chat-guest',
      partialize: (state) => ({
        token: state.token,
        nickname: state.nickname,
        guestId: state.guestId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.token && !state.guestId) {
          state.guestId = peekGuestIdFromToken(state.token);
        }
        useChatGuestStore.getState().setHasHydrated(true);
      },
    },
  ),
);
