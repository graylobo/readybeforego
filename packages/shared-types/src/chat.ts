import { z } from 'zod';
import { CHAT_LIMITS, GUEST_NICKNAME_REGEX } from './chat-utils';

export interface ChatSettings {
  enabled: boolean;
  persistEnabled: boolean;
  showOnlineCount: boolean;
  showMessageTime: boolean;
  defaultOpen: boolean;
  updatedAt: string;
}

export const UpdateChatSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  persistEnabled: z.boolean().optional(),
  showOnlineCount: z.boolean().optional(),
  showMessageTime: z.boolean().optional(),
  defaultOpen: z.boolean().optional(),
});
export type UpdateChatSettingsRequest = z.infer<typeof UpdateChatSettingsSchema>;

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

export const DeleteChatMessageSchema = z.object({
  id: z.string().uuid(),
  room: z.string().min(1).max(32).optional(),
});
export type DeleteChatMessageDto = z.infer<typeof DeleteChatMessageSchema>;

export interface ChatDeletePayload {
  id: string;
  room?: string;
}

export interface ChatMessageDeletedPayload {
  room: string;
  id: string;
}

export interface ChatJoinPayload {
  room?: string;
}
