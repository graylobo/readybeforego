'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/stores/auth.store';
import { isAdmin } from '@community/shared-types';
import { AlertOctagon, Award, Film, Home, MessageSquare, Settings, Shield, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [hasCheckedAuth, setHasCheckedAuth] = React.useState(false);

  // Initial Auth Check
  useEffect(() => {
      async function splitCheck() {
          await checkAuth(); // Ensure auth is checked
          setHasCheckedAuth(true);
      }
      splitCheck();
  }, [checkAuth]);

  useEffect(() => {
    if (!hasCheckedAuth || isLoading) return;

    if (!isAuthenticated) {
      router.push(`/login?redirect=${pathname}`);
      return;
    }
    if (!isAdmin(user?.role)) {
      router.push('/');
      return;
    }
  }, [isAuthenticated, user, isLoading, hasCheckedAuth, router, pathname]);

  if (!hasCheckedAuth || isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex flex-1 overflow-hidden relative">
          <div className="w-64 border-r border-border bg-card hidden md:flex flex-col p-4 gap-4">
             <Skeleton className="h-8 w-3/4" />
             <Skeleton className="h-8 w-full" />
             <Skeleton className="h-8 w-full" />
          </div>
          <main className="flex-1 p-8">
            <Skeleton className="mb-8 h-8 w-48" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin(user?.role)) return null;

  const adminMenuItems = [
    {
      id: 'admin-dashboard',
      label: '대시보드',
      icon: <Home className="h-5 w-5" />,
      href: '/admin',
    },
    {
      id: 'admin-users',
      label: '사용자 관리',
      icon: <Users className="h-5 w-5" />,
      href: '/admin/users',
    },
    {
      id: 'admin-boards',
      label: '게시판 관리',
      icon: <MessageSquare className="h-5 w-5" />,
      href: '/admin/boards',
    },
    {
      id: 'admin-logs',
      label: '로그 관리',
      icon: <Shield className="h-5 w-5" />,
      href: '/admin/logs',
    },
    {
      id: 'admin-reports',
      label: '신고 관리',
      icon: <AlertOctagon className="h-5 w-5" />,
      href: '/admin/reports',
    },
    {
      id: 'admin-points',
      label: '포인트 관리',
      icon: <Award className="h-5 w-5" />,
      href: '/admin/points',
    },
    {
      id: 'admin-emoticons',
      label: '이모티콘 관리',
      icon: <Film className="h-5 w-5" />,
      href: '/admin/emoticons',
    },
    {
      id: 'admin-settings',
      label: '환경 설정',
      icon: <Settings className="h-5 w-5" />,
      href: '/admin/settings',
    },
    {
      id: 'main',
      label: '메인으로',
      icon: <Home className="h-5 w-5" />,
      href: '/',
    },
  ];

  // 클라이언트 페이지와 동일한 셸(사이드바 + 헤더 + 본문)을 공유하되,
  // 어드민 전용 메뉴를 주입하고 커뮤니티 전용 푸터는 노출하지 않는다.
  return (
    <AppLayout
      variant="admin"
      menuItems={adminMenuItems}
      showFooter={false}
      contentClassName="p-8"
    >
      {children}
    </AppLayout>
  );
}
