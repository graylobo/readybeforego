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

  // Protection: If already setup, don't allow staying on auth pages (except if they are specifically trying to logout, but we handle that in LoginForm usually)
  React.useEffect(() => {
    if (mounted && isAuthenticated && user?.isProfileSetup) {
      // We only redirect away if they are on /login or /auth/setup
      // But Since this layout is ONLY for (auth) group, it covers those.
      router.replace('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col",
      !mounted && "opacity-0 !pointer-events-none"
    )}>
      {children}
    </div>
  );
}
