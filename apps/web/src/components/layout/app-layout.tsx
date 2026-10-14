'use client';

import { ChatShell } from '@/components/chat';
import { Footer } from '@/components/common/footer';
import { Sidebar } from '@/components/sidebar/sidebar';
import { useSidebarToggleStore } from '@/lib/stores/sidebar-toggle.store';
import { cn } from '@/lib/utils/cn';
import React from 'react';
import { Header } from './header';

import { useMenuItems, type MenuItem } from '@/hooks/use-menu-items';
import type { SidebarInitialData } from '@/lib/sidebar-initial-data';
import { syncLayoutMode, useLayoutStore } from '@/lib/stores/layout.store';
import { parseLayoutMode } from '@/lib/layout-mode';
import { useAuthStore } from '@/lib/stores/auth.store';
import { usePathname, useRouter } from 'next/navigation';
import { PageLoading } from './page-loading';
import { MAIN_SCROLL_ID, MainScrollRestoration } from './main-scroll-restoration';
import { Map, MessageCircleMore, MessageCircleQuestionMark, SlidersHorizontal } from 'lucide-react';

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
  /** 서버에서 미리 받은 사이드바 데이터 (첫 화면부터 메뉴가 맞게 그려지도록) */
  initialSidebarData?: SidebarInitialData;
}

export function AppLayout({
  children,
  menuItems: menuItemsProp,
  showFooter = true,
  contentClassName,
  variant = 'client',
  initialSidebarData,
}: AppLayoutProps) {
  const clientMenuItems = useMenuItems(initialSidebarData);
  const menuItems = menuItemsProp ?? clientMenuItems;
  const { pendingPath, setPendingPath } = useLayoutStore();
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
    const pathname = usePathname();
    const [showLoading, setShowLoading] = React.useState(false);
  // 스크롤은 화면 전체가 아니라 <main>에서 일어난다 (뒤로가기 위치 복원: MainScrollRestoration)
  const mainRef = React.useRef<HTMLElement>(null);

  // Reset pendingPath whenever pathname changes
  React.useEffect(() => {
    setPendingPath(null);
  }, [pathname, setPendingPath]);


  // 이동이 200ms 넘게 걸릴 때만 스켈레톤을 보여준다 (빠른 이동에서 깜빡이지 않게)
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
  // 모바일 하단 내비게이션의 게시판 버튼이 여는 게시판
  const firstBoardHref = '/board/lounge';

  // 레이아웃 모드(sidebar/top)는 head의 layoutModeBootstrapScript가 하이드레이션 전에 붙인 data-layout과
  // globals.css 규칙으로 그린다. 서버는 쿠키를 읽지 않으므로(페이지가 동적으로 바뀌지 않게) 스토어는 마운트 후 맞춘다.
  // 어드민 영역은 top 레이아웃을 지원하지 않고 항상 사이드바 모드로 통일한다 (data-layout 규칙 클래스를 붙이지 않음).
  React.useEffect(() => {
    if (isAdminVariant) return;
    syncLayoutMode(parseLayoutMode(document.documentElement.getAttribute('data-layout')));
  }, [isAdminVariant]);

  // AdSense 등이 body/html 스크롤을 유발해도 앱 셸만 스크롤되도록 잠근다.
  React.useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.height = '100%';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.height = prev.htmlHeight;
      body.style.height = prev.bodyHeight;
    };
  }, []);


  // Protection: If on main(client) layout but profile not setup, redirect to setup.
  // 어드민 레이아웃은 자체 인증 가드를 가지므로 여기서는 클라이언트에서만 처리한다.
  React.useEffect(() => {
    if (!isAdminVariant && isAuthenticated && user && !user.isProfileSetup) {
      router.replace('/auth/setup');
    }
  }, [isAdminVariant, isAuthenticated, user, router]);

  return (
    // 하이드레이션 전에도 서버 렌더링 HTML이 그대로 보이도록 숨기지 않는다 (첫 화면 표시가 JS 실행을 기다리지 않게)
    <div className={cn(
      "h-dvh max-h-dvh flex overflow-hidden relative transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]",
      !isAdminVariant && "app-layout-shell"
    )}>
      <div className={cn(!isAdminVariant && "app-layout-sidebar")}>
        <Sidebar items={menuItems} />
      </div>
      <SidebarOverlay />

       <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative transition-[padding] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]">
        <Header variant={variant} />
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <main ref={mainRef} id={MAIN_SCROLL_ID} className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-background w-full flex flex-col transition-colors duration-300 min-w-0">
            <div className={cn("flex-1", contentClassName)}>
              {/* 여기에 Suspense/loading.tsx 대체 화면을 두지 않는다. React는 대체 화면을 한 번 보이면 실제 내용으로
                  바꾸기까지 최소 300ms를 기다려서, 처음 접속(스트리밍)과 사이트 안 이동 모두 데이터가 빨리 와도 300ms 이상 걸린다.
                  이동이 느릴 때의 스켈레톤은 위 showLoading(200ms 지연)이 맡는다 */}
              {showLoading ? <PageLoading /> : children}
            </div>
            {showFooter && <Footer />}
          </main>
          <React.Suspense fallback={null}>
            <MainScrollRestoration mainRef={mainRef} />
          </React.Suspense>
          {!isAdminVariant && <ChatShell />}
        </div>
      </div>

      {/* 모바일 전용 하단 네비게이션 바 🧭 */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around z-40 md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => router.push('/')}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 cursor-pointer transition-colors",
            pathname === '/' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Map className="h-5 w-5" />
        </button>

        <button
          onClick={() => router.push(firstBoardHref)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 cursor-pointer transition-colors",
            pathname.startsWith('/board') ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageCircleMore className="h-5 w-5" />
        </button>

        <button
          onClick={() => router.push('/board/inquiry')}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 cursor-pointer transition-colors",
            pathname.startsWith('/emoticons') ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageCircleQuestionMark className="h-5 w-5" />
        </button>

        <button
          onClick={() => router.push('/profile')}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 cursor-pointer transition-colors",
            pathname.startsWith('/profile') ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

