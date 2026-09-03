'use client';

import { MessageSquare } from 'lucide-react';
import { useIsLgUp } from '@/hooks/use-media-query';
import { useChatUiStore } from '@/lib/stores/chat-ui.store';

export function ChatFab() {
  const isDesktop = useIsLgUp();
  const mobileMode = useChatUiStore((state) => state.mobileMode);
  const railOpen = useChatUiStore((state) => state.railOpen);
  const open = useChatUiStore((state) => state.open);

  const panelVisible = isDesktop ? railOpen : mobileMode !== 'closed';
  if (panelVisible) return null;

  return (
    <button
      type="button"
      onClick={open}
      className="fixed z-[95] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center cursor-pointer hover:opacity-95 active:scale-95 transition-transform"
      style={{
        right: 'max(1rem, env(safe-area-inset-right))',
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
      aria-label="채팅 열기"
    >
      <MessageSquare className="h-6 w-6" />
    </button>
  );
}
