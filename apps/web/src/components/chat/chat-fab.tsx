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
        // 화면 아래에 고정 메뉴(모바일 하단 내비게이션 등)가 있는 프로젝트는 --chat-fab-bottom-offset에 그 높이를 넣어 버튼을 위로 올린다
        bottom: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + var(--chat-fab-bottom-offset, 0px))',
      }}
      aria-label="채팅 열기"
    >
      <MessageSquare className="h-6 w-6" />
    </button>
  );
}
