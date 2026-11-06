'use client';

import { useRealtimeConfig } from '@/hooks/queries/use-realtime-config';
import { useChatRealtime } from '@/hooks/use-chat-realtime';
import { useChatSocket } from '@/hooks/use-chat-socket';

/**
 * 채팅 연결. 서버 설정(GET /realtime/config)에 따라 Supabase Realtime 또는 API 서버 웹소켓을 쓴다.
 * 둘은 같은 값을 돌려주므로 채팅 화면은 어느 쪽인지 몰라도 된다 (설정을 받기 전에는 둘 다 연결하지 않음)
 */
export function useChatConnection({ enabled }: { enabled: boolean }) {
  const { data: config, isError } = useRealtimeConfig();
  const provider = config?.provider ?? (isError ? 'server' : null);
  const supabase = useChatRealtime({
    enabled: enabled && provider === 'supabase',
    config: config?.provider === 'supabase' ? config : null,
  });
  const server = useChatSocket({ enabled: enabled && provider === 'server' });
  return provider === 'supabase' ? supabase : server;
}
