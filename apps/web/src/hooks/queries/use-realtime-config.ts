import { useQuery } from '@tanstack/react-query';
import { realtimeApi } from '@/lib/api/realtime';

/** 실시간 연결 방식. 서버 설정이라 한 번 받으면 바뀌지 않는다 (받지 못하면 API 서버 연결 방식) */
export function useRealtimeConfig() {
  return useQuery({
    queryKey: ['realtime', 'config'],
    queryFn: realtimeApi.getConfig,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
