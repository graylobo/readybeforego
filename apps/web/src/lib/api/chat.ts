import {
  ChatGuestClaimResponse,
  ChatMessage,
  ChatSession,
  ChatSettings,
  UpdateChatSettingsRequest,
  CHAT_LIMITS,
  CHAT_ROOM_DEFAULT,
} from '@community/shared-types';
import { apiClient } from '@/lib/api-client';

export const chatApi = {
  getSettings: async (): Promise<ChatSettings> => {
    const response = await apiClient.get('/chat/settings', { _skipToast: true });
    return response.data;
  },

  updateSettings: async (data: UpdateChatSettingsRequest): Promise<ChatSettings> => {
    const response = await apiClient.patch('/chat/settings', data);
    return response.data;
  },

  claimGuestNickname: async (nickname: string): Promise<ChatGuestClaimResponse> => {
    const response = await apiClient.post(
      '/chat/guest/claim',
      { nickname },
      { _skipToast: true },
    );
    return response.data;
  },

  getMessages: async (
    room: string = CHAT_ROOM_DEFAULT,
    limit: number = CHAT_LIMITS.HISTORY_DEFAULT,
  ): Promise<ChatMessage[]> => {
    const response = await apiClient.get('/chat/messages', {
      params: { room, limit },
    });
    return response.data?.messages ?? [];
  },

  getOnlineCount: async (room: string = CHAT_ROOM_DEFAULT): Promise<number> => {
    const response = await apiClient.get('/chat/online', { params: { room } });
    return response.data?.count ?? 0;
  },

  /*
   * Supabase Realtime을 쓸 때 웹소켓 대신 쓰는 요청 (보내기·지우기·내 역할 확인). 비회원은 x-guest-token으로 누구인지 알린다.
   * 오류 알림은 채팅 화면이 직접 보여주므로 공통 토스트는 띄우지 않는다
   */
  getSession: async (guestToken?: string | null): Promise<ChatSession> => {
    const response = await apiClient.get('/chat/session', {
      headers: guestToken ? { 'x-guest-token': guestToken } : undefined,
      _skipToast: true,
    });
    return response.data;
  },

  sendMessage: async (
    body: { content: string; replyToId?: string; room?: string },
    guestToken?: string | null,
  ): Promise<ChatMessage> => {
    const response = await apiClient.post('/chat/messages', body, {
      headers: guestToken ? { 'x-guest-token': guestToken } : undefined,
      _skipToast: true,
    });
    return response.data;
  },

  deleteMessage: async (id: string, room: string, guestToken?: string | null): Promise<{ room: string; id: string }> => {
    const response = await apiClient.delete(`/chat/messages/${encodeURIComponent(id)}`, {
      params: { room },
      headers: guestToken ? { 'x-guest-token': guestToken } : undefined,
      _skipToast: true,
    });
    return response.data;
  },

  clearMessages: async (
    room: string = CHAT_ROOM_DEFAULT,
  ): Promise<{ room: string; deletedCount: number }> => {
    const response = await apiClient.delete('/chat/messages', { params: { room } });
    return response.data;
  },
};
