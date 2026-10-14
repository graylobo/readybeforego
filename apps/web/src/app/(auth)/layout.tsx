'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

import { useAuthStore } from '@/lib/stores/auth.store';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 이미 로그인(프로필 설정까지)한 사람은 설정 화면에 머물 필요가 없어 메인으로 보낸다.
  // 로그인 화면(/login)은 제외: LoginForm이 redirect(원래 가려던 곳)로 보내는데, 여기서 '/'로 덮어쓰면
  // 로그인한 사람이 로그인 필요 안내를 거쳐 들어왔을 때 원래 화면 대신 메인으로 가 버렸다
  React.useEffect(() => {
    if (mounted && isAuthenticated && user?.isProfileSetup && pathname !== '/login') {
      router.replace('/');
    }
  }, [mounted, isAuthenticated, user, router, pathname]);

  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col",
      !mounted && "opacity-0 !pointer-events-none"
    )}>
      {children}
    </div>
  );
}
