'use client';

import { MessageSquareOff } from 'lucide-react';

export function ChatUnavailable() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card px-6 text-center">
      <div className="h-12 w-12 rounded-full border border-border text-muted-foreground flex items-center justify-center mb-2">
        <MessageSquareOff className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium">채팅을 잠시 사용할 수 없습니다</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        연결이 복구되면 자동으로 다시 시도합니다.
      </p>
    </div>
  );
}
