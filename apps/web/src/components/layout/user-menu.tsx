'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { messageKeys, useUnreadMessageCount } from '@/hooks/queries/use-message-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { cn } from '@/lib/utils/cn';
import { isAdmin, isStaff } from '@community/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import {
    Bookmark,
    LayoutDashboard,
    LogOut,
    Mail,
    Shield,
    User as UserIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: unreadCount = 0 } = useUnreadMessageCount();

  if (!user) return null;

  return (
    <DropdownMenu onOpenChange={(open) => {
      if (open) {
        queryClient.invalidateQueries({ queryKey: messageKeys.unreadCount });
      }
    }}>
      <DropdownMenuTrigger asChild>
        <div className={cn(
          "cursor-pointer outline-none group",
          !user.isProfileSetup && "pointer-events-none"
        )}>
          <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-border/50 transition-all group-hover:border-primary/30">
            {user.picture && (
              <AvatarImage src={user.picture} alt={user.name} />
            )}
            <AvatarFallback className="relative overflow-visible bg-muted text-muted-foreground font-bold">
              {user.name?.charAt(0) || 'U'}
              {isAdmin(user.role) && (
                <span className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                  <Shield className="h-3 w-3 text-blue-500 fill-blue-500" />
                </span>
              )}
              {!isAdmin(user.role) && isStaff(user.role) && (
                <span className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                  <Shield className="h-3 w-3 text-green-500 fill-green-500" />
                </span>
              )}
            </AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-border/50">
        <div className="flex items-center gap-3 p-3 mb-2">
            <Avatar className="h-10 w-10 border border-border/50">
                {user.picture && (
                    <AvatarImage src={user.picture} alt={user.name} />
                )}
                <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
                <span className="text-sm font-black truncate">{user.name}</span>
                <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
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
          onClick={() => router.push('/scraped')}
          className="flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer group"
        >
          <Bookmark className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-semibold">스크랩 게시글</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => {
            router.push('/messages');
            queryClient.invalidateQueries({ queryKey: messageKeys.unreadCount });
          }}
          className="flex items-center py-2.5 px-3 rounded-xl cursor-pointer group whitespace-nowrap"
        >
          <div className="flex items-center gap-2 flex-1">
            <Mail className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-semibold">쪽지</span>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[11px] font-black text-primary">{unreadCount}개</span>
                <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[9px] font-black text-white shadow-sm shadow-rose-500/20">N</div>
              </div>
            )}
          </div>
        </DropdownMenuItem>


        <DropdownMenuSeparator className="my-2" />

        {isStaff(user.role) && (
            <>
                <DropdownMenuItem 
                    onClick={() => router.push('/admin')}
                    className="flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer group"
                >
                    <LayoutDashboard className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-semibold">관리자 도구</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
            </>
        )}

        <DropdownMenuItem 
          onClick={logout}
          className="flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer group"
        >
          <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-semibold">로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
