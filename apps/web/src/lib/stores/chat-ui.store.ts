import { create } from 'zustand';
import type { ChatMessage } from '@community/shared-types';

export type ChatMobileMode = 'closed' | 'half' | 'full';

interface ChatUiState {
  mobileMode: ChatMobileMode;
  /** PC(lg+) 우측 레일 표시 여부 */
  railOpen: boolean;
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

export const useChatUiStore = create<ChatUiState>((set) => ({
  mobileMode: 'closed',
  railOpen: true,
  selectedMessageId: null,
  replyTo: null,
  highlightedMessageId: null,
  open: () => set({ mobileMode: 'half', railOpen: true }),
  expand: () => set({ mobileMode: 'full' }),
  shrink: () => set({ mobileMode: 'half' }),
  close: () =>
    set({
      mobileMode: 'closed',
      railOpen: false,
      selectedMessageId: null,
    }),
  toggle: () =>
    set((state) => {
      const open = state.mobileMode !== 'closed' || state.railOpen;
      if (open) {
        return { mobileMode: 'closed', railOpen: false, selectedMessageId: null };
      }
      return { mobileMode: 'half', railOpen: true };
    }),
  selectMessage: (id) =>
    set((state) => ({
      selectedMessageId: state.selectedMessageId === id ? null : id,
    })),
  startReply: (message) => set({ replyTo: message, selectedMessageId: null }),
  clearReply: () => set({ replyTo: null }),
  highlightMessage: (id) => set({ highlightedMessageId: id }),
}));
