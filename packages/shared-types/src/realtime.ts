/**
 * 실시간 연결 방식. server: 브라우저가 API 서버에 직접 연결 (채팅 socket.io, 알림 SSE)
 * supabase: 브라우저가 Supabase Realtime 채널을 듣고, API 서버는 보낼 때만 짧게 요청한다
 */
export type RealtimeConfig =
  | { provider: 'server' }
  | { provider: 'supabase'; url: string; anonKey: string };

/** Supabase Realtime 채널로 오가는 이벤트 이름 */
export const REALTIME_EVENTS = {
  CHAT_MESSAGE: 'message',
  CHAT_MESSAGE_DELETED: 'message_deleted',
  CHAT_HISTORY_CLEARED: 'history_cleared',
  NOTIFICATION: 'notification',
} as const;
