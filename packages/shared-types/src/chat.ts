import { z } from 'zod';

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

export interface ChatSettings {
  enabled: boolean;
  persistEnabled: boolean;
  showOnlineCount: boolean;
  showMessageTime: boolean;
  updatedAt: string;
}

export const UpdateChatSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  persistEnabled: z.boolean().optional(),
  showOnlineCount: z.boolean().optional(),
  showMessageTime: z.boolean().optional(),
});
export type UpdateChatSettingsRequest = z.infer<typeof UpdateChatSettingsSchema>;

export const CHAT_SOCKET_NAMESPACE = '/chat';

export const CHAT_EVENTS = {
  JOIN: 'join',
  SEND: 'send',
  JOINED: 'joined',
  MESSAGE: 'message',
  HISTORY: 'history',
  ONLINE: 'online',
  ERROR: 'error',
  AVAILABLE: 'available',
} as const;

export const GUEST_NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/;

export const ClaimGuestNicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(CHAT_LIMITS.NICKNAME_MIN, '닉네임은 2자 이상이어야 합니다.')
    .max(CHAT_LIMITS.NICKNAME_MAX, '닉네임은 12자 이하이어야 합니다.')
    .regex(GUEST_NICKNAME_REGEX, '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다. (공백 및 특수문자 불가)'),
});
export type ClaimGuestNicknameDto = z.infer<typeof ClaimGuestNicknameSchema>;

export const SendChatMessageSchema = z.object({
  content: z
    .string()
    .min(1, '메시지 내용을 입력해주세요.')
    .max(CHAT_LIMITS.MESSAGE_MAX, `메시지는 최대 ${CHAT_LIMITS.MESSAGE_MAX}자까지 가능합니다.`),
  room: z.string().min(1).max(32).optional(),
  replyToId: z.string().uuid().optional(),
});
export type SendChatMessageDto = z.infer<typeof SendChatMessageSchema>;

export type ChatAuthorType = 'member' | 'guest';
export type ChatClientRole = 'member' | 'guest' | 'spectator';

export interface ChatReplyTo {
  id: string;
  nickname: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  roomSlug: string;
  authorType: ChatAuthorType;
  userId: string | null;
  /** 게스트 작성자 구분용. 회원 메시지는 null */
  guestId: string | null;
  nickname: string;
  content: string;
  createdAt: string;
  replyTo?: ChatReplyTo | null;
}

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

export interface ChatGuestClaimResponse {
  token: string;
  nickname: string;
  guestId: string;
  expiresIn: number;
}

export interface ChatJoinedPayload {
  room: string;
  role: ChatClientRole;
  nickname: string | null;
  onlineCount: number;
  /** 회원일 때 본인 userId (내 메시지 표시용) */
  userId?: string | null;
  /** 게스트일 때 본인 guestId (내 메시지 표시용) */
  guestId?: string | null;
}

export interface ChatOnlinePayload {
  room: string;
  count: number;
}

export interface ChatErrorPayload {
  code: string;
  message: string;
}

export interface ChatHistoryPayload {
  room: string;
  messages: ChatMessage[];
}

export interface ChatSendPayload {
  content: string;
  room?: string;
  replyToId?: string;
}

export interface ChatJoinPayload {
  room?: string;
}
