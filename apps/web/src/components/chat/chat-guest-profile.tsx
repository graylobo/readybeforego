'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { guestAvatarClass } from '@/components/chat/chat-guest-menu';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';
import { cn } from '@/lib/utils/cn';
import { formatGuestTag } from '@community/shared-types';
import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function ChatGuestProfileView() {
  const router = useRouter();
  const nickname = useChatGuestStore((state) => state.nickname);
  const guestId = useChatGuestStore((state) => state.guestId);
  const clearGuest = useChatGuestStore((state) => state.clearGuest);

  if (!nickname) return null;

  const avatarSeed = guestId || nickname;
  const tag = guestId ? formatGuestTag(guestId) : null;

  return (
    <div className="container max-w-2xl mx-auto py-10 space-y-8">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border border-border/50 shadow-sm">
            <AvatarFallback className={cn('text-xl font-bold', guestAvatarClass(avatarSeed))}>
              {nickname.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h1 className="text-xl font-bold truncate">{nickname}</h1>
            {tag && (
              <span className="shrink-0 text-sm font-mono text-muted-foreground">{tag}</span>
            )}
            <span className="shrink-0 rounded-full border border-border bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              비회원
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center max-w-sm">
          채팅용 임시 닉네임입니다. 고정닉으로 가입하면 프로필·쪽지·포인트 등 회원 기능을 사용할 수 있습니다.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
          <Button asChild className="flex-1 cursor-pointer">
            <Link href="/login">
              <LogIn className="w-4 h-4 mr-1.5" />
              고정닉 가입
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={() => {
              clearGuest();
              router.push('/');
            }}
          >
            닉네임 초기화
          </Button>
        </div>
      </div>
    </div>
  );
}
