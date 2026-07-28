'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/stores/auth.store';
import { isAdmin } from '@community/shared-types';
import { AlertOctagon, AlertTriangle, Award, Film, HelpCircle, Home, MessageSquare, Settings, Shield, Users } from 'lucide-react';
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

  // Redirection Logic
  useEffect(() => {
    if (!isLoading && hasCheckedAuth) {
      if (!isAuthenticated) {
        router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
      } else if (!isAdmin(user?.role)) {
        // Redirect unauthorized non-admins to home page
        router.push('/');
      }
    }
  }, [isAuthenticated, user, isLoading, hasCheckedAuth, router, pathname]);

  if (isLoading || !hasCheckedAuth) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[400px] w-full" />
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
      id: 'admin-scams',
      label: '사기 제보 관리',
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      href: '/admin/scams',
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
      id: 'admin-inquiries',
      label: '1:1 문의 관리',
      icon: <HelpCircle className="h-5 w-5 text-sky-500" />,
      href: '/admin/inquiries',
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
