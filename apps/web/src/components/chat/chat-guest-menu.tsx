'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';
import { cn } from '@/lib/utils/cn';
import { formatGuestTag } from '@community/shared-types';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

const GUEST_AVATAR_COLORS = [
  'bg-rose-500 text-white',
  'bg-fuchsia-500 text-white',
  'bg-violet-500 text-white',
  'bg-sky-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
];

export function guestAvatarClass(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return GUEST_AVATAR_COLORS[Math.abs(hash) % GUEST_AVATAR_COLORS.length];
}

export function ChatGuestMenu() {
  const router = useRouter();
  const nickname = useChatGuestStore((state) => state.nickname);
  const guestId = useChatGuestStore((state) => state.guestId);
  const clearGuest = useChatGuestStore((state) => state.clearGuest);

  if (!nickname) return null;

  const avatarSeed = guestId || nickname;
  const tag = guestId ? formatGuestTag(guestId) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer outline-none group" aria-label="게스트 메뉴">
          <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-border/50 transition-all group-hover:border-primary/30">
            <AvatarFallback className={cn('font-bold', guestAvatarClass(avatarSeed))}>
              {nickname.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-border/50">
        <div className="flex items-center gap-3 p-3 mb-2">
          <Avatar className="h-10 w-10 border border-border/50">
            <AvatarFallback className={cn('font-bold', guestAvatarClass(avatarSeed))}>
              {nickname.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-black truncate">{nickname}</span>
              {tag && (
                <span className="shrink-0 text-[11px] font-mono text-muted-foreground">{tag}</span>
              )}
              <span className="shrink-0 rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                비회원
              </span>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className="mb-2" />

        <DropdownMenuItem
          onClick={() => router.push('/profile')}
          className="flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer group"
        >
          <UserIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-semibold">마이페이지</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push('/login')}
          className="flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer group"
        >
          <LogIn className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-semibold">고정닉 가입</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-2" />

        <DropdownMenuItem
          onClick={() => {
            clearGuest();
            router.refresh();
          }}
          className="flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer group"
        >
          <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-semibold">닉네임 초기화</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
