import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '@community/shared-types';

export type ChatMobileMode = 'closed' | 'half' | 'full';

interface ChatUiState {
  mobileMode: ChatMobileMode;
  /** PC(lg+) 우측 레일 표시 여부 */
  railOpen: boolean;
  /** 유저가 직접 열거나 닫은 마지막 선택 상태 (null이면 어드민 설정 사용) */
  userOverride: boolean | null;
  selectedMessageId: string | null;
  replyTo: ChatMessage | null;
  highlightedMessageId: string | null;
  open: () => void;
  expand: () => void;
  shrink: () => void;
  close: () => void;
  toggle: () => void;
  selectMessage: (id: string | null) => void;
  startReply: (message: ChatMessage) => void;
  clearReply: () => void;
  highlightMessage: (id: string | null) => void;
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set) => ({
      mobileMode: 'closed',
      railOpen: true,
      userOverride: null,
      selectedMessageId: null,
      replyTo: null,
      highlightedMessageId: null,
      open: () => set({ mobileMode: 'half', railOpen: true, userOverride: true }),
      expand: () => set({ mobileMode: 'full' }),
      shrink: () => set({ mobileMode: 'half' }),
      close: () =>
        set({
          mobileMode: 'closed',
          railOpen: false,
          selectedMessageId: null,
          userOverride: false,
        }),
      toggle: () =>
        set((state) => {
          const isOpen = state.mobileMode !== 'closed' || state.railOpen;
          if (isOpen) {
            return {
              mobileMode: 'closed',
              railOpen: false,
              selectedMessageId: null,
              userOverride: false,
            };
          }
          return { mobileMode: 'half', railOpen: true, userOverride: true };
        }),
      selectMessage: (id) =>
        set((state) => ({
          selectedMessageId: state.selectedMessageId === id ? null : id,
        })),
      startReply: (message) => set({ replyTo: message, selectedMessageId: null }),
      clearReply: () => set({ replyTo: null }),
      highlightMessage: (id) => set({ highlightedMessageId: id }),
    }),
    {
      name: 'community-chat-ui-pref',
      partialize: (state) => ({ userOverride: state.userOverride }),
    },
  ),
);
