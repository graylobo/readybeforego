import {
  ChatGuestClaimResponse,
  ChatMessage,
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

  clearMessages: async (
    room: string = CHAT_ROOM_DEFAULT,
  ): Promise<{ room: string; deletedCount: number }> => {
    const response = await apiClient.delete('/chat/messages', { params: { room } });
    return response.data;
  },
};
