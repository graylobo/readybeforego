import type { RealtimeClient } from '@supabase/realtime-js';
import type { RealtimeConfig } from '@community/shared-types';

type SupabaseRealtimeConfig = Extract<RealtimeConfig, { provider: 'supabase' }>;

let current: { key: string; client: Promise<RealtimeClient> } | null = null;

/**
 * Supabase Realtime 연결 하나를 탭 전체가 함께 쓴다 (채팅·알림 채널이 한 연결 위에서 오간다).
 * 라이브러리는 실시간 기능을 쓸 때만 받아 오도록 나중에 불러온다
 */
export function getRealtimeClient(config: SupabaseRealtimeConfig): Promise<RealtimeClient> {
  const key = `${config.url}|${config.anonKey}`;
  if (current?.key === key) return current.client;
  const client = import('@supabase/realtime-js').then(({ RealtimeClient }) => {
    const realtime = new RealtimeClient(config.url, { params: { apikey: config.anonKey } });
    // 비공개 채널 권한(RLS)은 접속 토큰의 역할(anon)로 확인한다. 새 형식 키(sb_publishable_…)는 JWT가 아니라 apikey로만 보낸다
    if (!config.anonKey.startsWith('sb_')) void realtime.setAuth(config.anonKey);
    return realtime;
  });
  current = { key, client };
  return client;
}
