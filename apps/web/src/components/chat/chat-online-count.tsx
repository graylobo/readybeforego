'use client';

import { cn } from '@/lib/utils/cn';

interface ChatOnlineCountProps {
  count: number;
  live?: boolean;
  className?: string;
}

export function ChatOnlineCount({ count, live = true, className }: ChatOnlineCountProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-emerald-400', className)}
      aria-label={`접속자 ${count.toLocaleString()}명`}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full shrink-0',
          live ? 'bg-emerald-400 chat-live-dot' : 'bg-muted-foreground/50',
        )}
        aria-hidden="true"
      />
      <span className="text-xs font-semibold tabular-nums">{count.toLocaleString()}</span>
    </span>
  );
}
