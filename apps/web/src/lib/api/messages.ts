import { apiClient } from '../api-client';
import { Message, SendMessageDto } from '@community/shared-types';

export const messagesApi = {
  sendMessage: async (dto: SendMessageDto): Promise<Message> => {
    const response = await apiClient.post('/messages', dto);
    return response.data;
  },

  getReceivedMessages: async (page: number = 1, limit: number = 20): Promise<{ items: { message: Message; sender: any }[]; total: number }> => {
    const response = await apiClient.get('/messages/received', { params: { page, limit } });
    return response.data;
  },

  getSentMessages: async (page: number = 1, limit: number = 20): Promise<{ items: { message: Message; receiver: any }[]; total: number }> => {
    const response = await apiClient.get('/messages/sent', { params: { page, limit } });
    return response.data;
  },

  getMessage: async (id: string): Promise<Message> => {
    const response = await apiClient.get(`/messages/${id}`);
    return response.data;
  },

  deleteMessage: async (id: string): Promise<void> => {
    await apiClient.delete(`/messages/${id}`);
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get('/messages/unread-count');
    return response.data.count;
  }
};
