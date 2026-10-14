/**
 * 채팅 상수와 표시용 함수 (zod 없음).
 * 입력 규칙(zod 스키마)과 분리해 두어, 화면에서 formatGuestTag 등만 가져와도 zod가 웹 번들에 들어가지 않게 한다.
 */
export const CHAT_LIMITS = {
  NICKNAME_MIN: 2,
  NICKNAME_MAX: 12,
  MESSAGE_MAX: 200,
  HISTORY_DEFAULT: 50,
  HISTORY_MAX: 100,
  RECENT_CACHE_SIZE: 200,
  RATE_LIMIT_WINDOW_MS: 3000,
  RATE_LIMIT_MAX: 5,
  MAX_CONNECTIONS_PER_IP: 8,
  GUEST_TOKEN_EXPIRES_IN: '30d',
  REPLY_PREVIEW_MAX: 40,
} as const;

export const CHAT_ROOM_DEFAULT = 'lobby';

export const CHAT_SOCKET_NAMESPACE = '/chat';

export const CHAT_EVENTS = {
  JOIN: 'join',
  SEND: 'send',
  DELETE: 'delete',
  JOINED: 'joined',
  MESSAGE: 'message',
  MESSAGE_DELETED: 'message_deleted',
  HISTORY: 'history',
  ONLINE: 'online',
  ERROR: 'error',
  AVAILABLE: 'available',
} as const;

export const GUEST_NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/;

export function formatChatReplyPreview(
  content: string,
  max: number = CHAT_LIMITS.REPLY_PREVIEW_MAX,
): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

/** 동일 닉 게스트를 UI에서 구분하기 위한 짧은 태그 (#a3f1) */
export function formatGuestTag(guestId: string): string {
  const compact = guestId.replace(/-/g, '').slice(0, 4).toLowerCase();
  return `#${compact}`;
}
