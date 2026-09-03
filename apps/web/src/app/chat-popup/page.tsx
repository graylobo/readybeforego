'use client';

import { ChatPanel } from '@/components/chat/chat-panel';
import { useChatFeature } from '@/components/chat/chat-feature-provider';

export default function ChatPopupPage() {
  const { enabled, ready } = useChatFeature();

  if (!ready) {
    return <div className="h-dvh bg-card" />;
  }

  if (!enabled) {
    return (
      <div className="h-dvh flex items-center justify-center bg-card px-6 text-center">
        <p className="text-sm text-muted-foreground">채팅을 사용할 수 없습니다.</p>
      </div>
    );
  }

  return <ChatPanel variant="popup" />;
}
