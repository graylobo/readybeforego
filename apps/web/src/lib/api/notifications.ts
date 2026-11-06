import { apiClient } from '../api-client';

export interface Notification {
  id: string;
  userId: string;
  type: 'COMMENT' | 'REPLY' | 'LIKE' | 'SYSTEM';
  content: string;
  targetId?: string;
  targetType?: 'POST' | 'COMMENT';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  findAll: async () => {
    const { data } = await apiClient.get<Notification[]>('/notifications');
    return data;
  },

  /** 내 알림 실시간 채널 이름 (Supabase Realtime을 쓸 때만 값이 있다) */
  getRealtimeTopic: async (): Promise<string | null> => {
    const { data } = await apiClient.get<{ topic: string | null }>('/notifications/realtime', { _skipToast: true });
    return data.topic;
  },

  getUnreadCount: async () => {
    const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
    return data;
  },

  markAsRead: async (id: string) => {
    const { data } = await apiClient.post(`/notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await apiClient.post('/notifications/read-all');
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete(`/notifications/${id}`);
    return data;
  },

  removeAll: async () => {
    const { data } = await apiClient.delete('/notifications');
    return data;
  },
};
