import { apiClient } from '../api-client';

export interface UserLog {
  id: string;
  userId: string;
  type: 'LOGIN' | 'POST_CREATE' | 'COMMENT_CREATE' | 'LIKE' | 'UPDATE_PROFILE' | 'DELETE_POST';
  action: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };
}

export const logsApi = {
  getMyLogs: async (): Promise<UserLog[]> => {
    const response = await apiClient.get('/logs/me');
    return response.data;
  },

  getAdminLogs: async (page: number = 1, limit: number = 50): Promise<{ items: UserLog[], total: number }> => {
    const response = await apiClient.get<{ items: UserLog[], total: number }>(`/logs/admin?page=${page}&limit=${limit}`);
    return response.data;
  }
};
