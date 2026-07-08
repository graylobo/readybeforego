'use client';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { useSidebarToggleStore } from '@/lib/stores/sidebar-toggle.store';
import { cn } from '@/lib/utils/cn';
import {
  Film,
  LayoutTemplate,
  LogIn,
  LogOut,
  Menu,
  Shield,
  X
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

import { isAdmin, isStaff } from '@community/shared-types';
import { TopNav } from './top-nav';
import { SearchBar } from './search-bar';

interface HeaderProps {
  /** 'admin'이면 커뮤니티 전용 UI(검색/탑네비/레이아웃 전환)를 숨기고 항상 사이드바 모드로 동작 */
  variant?: 'client' | 'admin';
}

export function Header({ variant = 'client' }: HeaderProps) {
  const { user, logout, checkAuth } = useAuthStore();
  const router = useRouter();
  const { toggle, isOpen } = useSidebarToggleStore();
  const { layoutMode: storeLayoutMode, toggleLayoutMode } = useLayoutStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isAdminVariant = variant === 'admin';
  // 어드민 영역은 top 레이아웃을 지원하지 않고 항상 사이드바 모드로 통일한다.
  const layoutMode = isAdminVariant ? 'sidebar' : storeLayoutMode;

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = () => {
    const currentUrl = encodeURIComponent(`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
    router.push(`/login?redirect=${currentUrl}`);
  };

  return (
    <header className={cn(
      "h-16 bg-background flex items-center justify-between pl-[10px] pr-4 md:px-6 shrink-0 gap-2 md:gap-4 z-50",
      layoutMode !== 'sidebar' && "border-b border-border"
    )}>
      <div className="flex items-center gap-2 md:gap-6 lg:gap-8 flex-1">
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className={cn(
              "text-foreground md:hidden", 
              isOpen && "relative z-[110]",
              user && !user.isProfileSetup && "hidden"
            )}
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className={cn(
              "text-foreground hidden md:flex transition-all duration-500",
              layoutMode === 'sidebar' && (!user || user.isProfileSetup) ? "opacity-100 translate-x-0 w-10 px-0" : "opacity-0 -translate-x-4 pointer-events-none w-0"
            )}
            aria-label="Toggle Sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>

        </div>

        <div 
          className={cn(
            "items-center gap-3 cursor-pointer transition-all duration-500 flex shrink-0 whitespace-nowrap",
            layoutMode === 'top' ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none absolute"
          )}
          onClick={() => router.push('/')}
        >
          <Film className="w-8 h-8 shrink-0" />
          <span className="text-xl font-bold select-none truncate hidden sm:block">Community</span>
        </div>

        {!isAdminVariant && <SearchBar />}
        {!isAdminVariant && <TopNav />}
      </div>
      
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {!isAdminVariant && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLayoutMode}
            className={cn(
              "text-muted-foreground hover:text-foreground hidden md:flex",
              user && !user.isProfileSetup && "md:hidden"
            )}
            title="레이아웃 전환"
          >
            <LayoutTemplate className="h-5 w-5" />
          </Button>
        )}
        <ThemeToggle />
        {user ? (
          <>
            {user.isProfileSetup && <NotificationBell />}
            <UserMenu />
          </>
        ) : (
          <>
            <Button
              onClick={handleLogin}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
              aria-label="Login"
              title="Login"
            >
              <LogIn className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
