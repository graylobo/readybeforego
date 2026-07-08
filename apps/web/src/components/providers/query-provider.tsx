'use client';

import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { toast } from '@/lib/toast';

// QueryMeta 타입을 확장하여 타입 안정성을 확보합니다.
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      preventToast?: boolean;
    };
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
      queryCache: new QueryCache({
          onError: (error: any, query) => {
              // 백그라운드 리페치(이미 캐시된 데이터가 화면에 표시되고 있는 경우) 중 발생한 에러는 
              // 토스트를 노출하지 않고 조용히 실패하게 하여 사용자 경험(UX)을 방해하지 않습니다.
              if (query.state.data !== undefined) {
                  return;
              }
              
              // 쿼리 메타에 preventToast: true 가 설정된 경우 에러 토스트를 표시하지 않습니다.
              if (query.meta?.preventToast) {
                  return;
              }

              // 최초 진입 시 데이터가 아예 없는 상황에서 에러가 발생한 경우에만 토스트 피드백을 제공합니다.
              const errorMessage = error.message || '데이터를 불러오는 중 오류가 발생했습니다.';
              toast.error(errorMessage);
          }
      }),
      defaultOptions: {
          queries: {
              staleTime: 60 * 1000,
          }
      }
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
