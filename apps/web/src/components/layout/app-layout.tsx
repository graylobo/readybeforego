'use client';


import { Footer } from '@/components/common/footer';
import { Sidebar } from '@/components/sidebar/sidebar';
import { useSidebarToggleStore } from '@/lib/stores/sidebar-toggle.store';
import { cn } from '@/lib/utils/cn';
import React from 'react';
import { Header } from './header';

import { useMenuItems, type MenuItem } from '@/hooks/use-menu-items';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import { usePathname, useRouter } from 'next/navigation';
import Loading from '@/app/(main)/loading';

function SidebarOverlay() {
  const { isOpen, toggle } = useSidebarToggleStore();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/20 backdrop-grayscale-[0.8] cursor-pointer transition-opacity duration-300 md:hidden"
      onClick={toggle}
      aria-hidden="true"
    />
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
  /** 사이드바 메뉴 (미지정 시 클라이언트 커뮤니티 메뉴 사용) */
  menuItems?: MenuItem[];
  /** 푸터 노출 여부 (어드민 등에서는 끌 수 있음) */
  showFooter?: boolean;
  /** 본문 래퍼에 적용할 추가 클래스 (예: 어드민 p-8 패딩) */
  contentClassName?: string;
  /** 'admin'이면 항상 사이드바 모드로 통일하고 헤더의 커뮤니티 전용 UI를 숨김 */
  variant?: 'client' | 'admin';
}

export function AppLayout({
  children,
  menuItems: menuItemsProp,
  showFooter = true,
  contentClassName,
  variant = 'client',
}: AppLayoutProps) {
  const clientMenuItems = useMenuItems();
  const menuItems = menuItemsProp ?? clientMenuItems;
  const { layoutMode: storeLayoutMode,pendingPath,setPendingPath } = useLayoutStore();
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
    const pathname = usePathname();
    const [showLoading, setShowLoading] = React.useState(false);

  // Reset pendingPath whenever pathname changes
  React.useEffect(() => {
    setPendingPath(null);
  }, [pathname, setPendingPath]);


  // Debounce showing the skeleton UI to prevent flickering on fast page loads
  React.useEffect(() => {
    const isPending = pendingPath !== null && pendingPath !== pathname;
    if (!isPending) {
      setShowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowLoading(true);
    }, 200); // 200ms delay threshold

    return () => clearTimeout(timer);
  }, [pendingPath, pathname]);

  const isAdminVariant = variant === 'admin';
  // 어드민 영역은 top 레이아웃을 지원하지 않고 항상 사이드바 모드로 통일한다.
  const layoutMode = isAdminVariant ? 'sidebar' : storeLayoutMode;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Protection: If on main(client) layout but profile not setup, redirect to setup.
  // 어드민 레이아웃은 자체 인증 가드를 가지므로 여기서는 클라이언트에서만 처리한다.
  React.useEffect(() => {
    if (!isAdminVariant && mounted && isAuthenticated && user && !user.isProfileSetup) {
      router.replace('/auth/setup');
    }
  }, [isAdminVariant, mounted, isAuthenticated, user, router]);

  return (
    <div className={cn(
      "h-screen flex overflow-hidden relative transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]", 
      layoutMode === 'top' && "flex-col",
      !mounted && "opacity-0 !pointer-events-none"
    )}>
      <div className={cn(layoutMode === 'top' && "md:hidden")}>
        <Sidebar items={menuItems} />
      </div>
      <SidebarOverlay />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-[padding] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]">
        <React.Suspense fallback={<div className="h-16 border-b bg-background" />}>
          <Header variant={variant} />
        </React.Suspense>
        <main className="flex-1 overflow-y-auto bg-background w-full flex flex-col transition-colors duration-300">
          <div className={cn("flex-1", contentClassName)}>
         {showLoading ? <Loading /> : children}
          </div>
          {showFooter && <Footer />}
        </main>
      </div>
    </div>
  );
}

