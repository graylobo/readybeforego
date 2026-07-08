'use client';

import { Mail } from 'lucide-react';
import { useUnreadMessageCount } from '@/hooks/queries/use-message-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { cn } from '@/lib/utils/cn';
import { useRouter } from 'next/navigation';

export function MessageBell() {
  const { user } = useAuthStore();
  const { data: unreadCount = 0 } = useUnreadMessageCount();
  const router = useRouter();

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => router.push('/messages')}
        className="relative p-2.5 rounded-full hover:bg-muted transition-all focus:outline-none active:scale-95 group cursor-pointer"
        title="쪽지함"
      >
        <Mail className={cn(
          "w-5 h-5 transition-transform group-hover:scale-110", 
          unreadCount > 0 
            ? "text-primary" 
            : "text-muted-foreground"
        )} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-blue-500 text-[9px] font-black text-white border-2 border-background shadow-sm transform translate-x-1/4 -translate-y-1/4">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
