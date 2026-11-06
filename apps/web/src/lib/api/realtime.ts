import type { RealtimeConfig } from '@community/shared-types';
import { apiClient } from '@/lib/api-client';

export const realtimeApi = {
  /** 실시간 연결 방식 (Supabase Realtime이면 접속 주소와 공개 키) */
  getConfig: async (): Promise<RealtimeConfig> => {
    const response = await apiClient.get('/realtime/config', { _skipToast: true });
    return response.data;
  },
};
