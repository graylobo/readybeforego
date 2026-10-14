'use client';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { API_URL } from '@/lib/api-client';
import { LayoutTemplate } from 'lucide-react';

/**
 * 쿼리는 effect 안에서 window.location으로 읽는다 (브라우저에서만 실행).
 * useSearchParams를 쓰면 정적 페이지인 로그인 화면 전체가 서버 HTML에 없고(Loading...만 보임) 브라우저에서만 그려진다.
 * 로그인 화면의 쿼리(redirect, OAuth 콜백의 user)는 페이지에 들어올 때 정해지므로 처음 한 번 읽으면 된다.
 */
function getQueryParam(name: string) {
  return new URLSearchParams(window.location.search).get(name);
}

/** 로그인 뒤 돌아갈 곳: 우리 사이트 안의 경로만 (다른 사이트 주소로 보내는 데 악용되지 않게) */
function safeRedirect(path: string | null): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  return path;
}

function LoginFormContent() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const redirect = getQueryParam('redirect');
    if (redirect) {
      sessionStorage.setItem('redirect_url', redirect);
    }
  }, []);

  useEffect(() => {
    const userStr = getQueryParam('user');

    if (userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        // Token is now in HttpOnly cookie, we don't need it in state/localStorage
        setAuth('', user);

        // IMMEDIATE REDIRECT: If profile is not setup, go straight to setup page to avoid flickering
        if (user && !user.isProfileSetup) {
          router.replace('/auth/setup');
          sessionStorage.removeItem('redirect_url');
          return;
        }

        const redirect = safeRedirect(getQueryParam('redirect') || sessionStorage.getItem('redirect_url'));
        sessionStorage.removeItem('redirect_url');
        
        setTimeout(() => {
          router.push(redirect || '/');
        }, 100);
      } catch (error) {
        console.error('Failed to parse user data:', error);
      }
    }
  }, [setAuth, router]);

  useEffect(() => {
    if (isAuthenticated && !getQueryParam('token')) {
      const redirect = safeRedirect(getQueryParam('redirect') || sessionStorage.getItem('redirect_url'));
      if (redirect) {
        sessionStorage.removeItem('redirect_url');
        router.push(redirect);
      } else {
        router.push('/');
      }
    }
  }, [isAuthenticated, router]);

  const handleSocialLogin = (provider: 'google' | 'kakao' | 'naver') => {
    window.location.href = `${API_URL}/auth/${provider}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background py-8 px-4">
      <div className="w-full max-w-lg flex flex-col items-center text-center">
        <div className="mb-16">
          {/* 로고있는경우 설정후 주석해제 */}
          {/* <div className={styles.logoWrapper}>
             <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center transform rotate-12 transition-transform hover:rotate-0 duration-500">
                <LayoutTemplate className="w-10 h-10 text-primary" />
             </div>
          </div> */}
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold tracking-tight text-foreground leading-[1.1] mb-6">
            COMMUNITY에 오신 것을<br/>환영합니다
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-[1.6]">
            지식과 경험을 나누는 즐거운 소통의 공간,<br/>커뮤니티와 함께 시작해 보세요.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <div className="flex items-center mb-6 text-xs font-bold text-muted-foreground uppercase tracking-widest justify-center before:flex-1 before:h-px before:bg-border after:flex-1 after:h-px after:bg-border">
             <span className="px-4">소셜 계정으로 로그인</span>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleSocialLogin('google')}
              className="w-full h-14 text-base font-bold transition-all duration-250 rounded-2xl flex items-center justify-center border border-border bg-card text-foreground hover:-translate-y-0.5 hover:shadow-lg hover:border-ring active:translate-y-0"
            >
              <div className="mr-4 h-6 w-6 flex items-center justify-center">
                 <img src="https://www.google.com/favicon.ico" alt="Google" width={20} height={20} className="w-full h-auto" />
              </div>
              Google로 계속하기
            </Button>

            <Button
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-14 text-base font-bold transition-all duration-250 rounded-2xl flex items-center justify-center bg-[#FEE500] text-[#191919] hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#FADA0A] active:translate-y-0"
            >
              <div className="mr-4 h-6 w-6 flex items-center justify-center">
                 <img src="/kakao_logo.png" alt="Kakao" width={20} height={20} className="w-full h-auto" />
              </div>
              카카오로 계속하기
            </Button>

            <Button
              onClick={() => handleSocialLogin('naver')}
              className="w-full h-14 text-base font-bold transition-all duration-250 rounded-2xl flex items-center justify-center bg-[#03C75A] text-white hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#02b351] active:translate-y-0"
            >
              <span className="mr-4 flex h-5 w-5 items-center justify-center rounded bg-white text-[#03C75A] font-extrabold text-xs">N</span>
              네이버로 계속하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return <LoginFormContent />;
}
