import { apiClient } from '../api-client';
import { User } from '@community/shared-types';

export interface UpdateProfileDto {
  name?: string;
  picture?: string; // For now handle as string URL
  isProfileSetup?: boolean;
}

export interface PublicProfile extends User {
  points: {
    level: number;
    accumulatedPoints: number;
    availablePoints: number;
  } | null;
  postCount: number;
  visitDays: number;
}

export const profileApi = {
  getPublicProfile: async (id: string): Promise<PublicProfile> => {
    const response = await apiClient.get(`/users/${id}/public`);
    return response.data;
  },
  updateProfile: async (data: UpdateProfileDto, options?: import('axios').AxiosRequestConfig): Promise<User> => {
    const response = await apiClient.patch('/users/me', data, options);
    return response.data;
  },
  withdrawAccount: async (): Promise<void> => {
    await apiClient.delete('/users/me');
  }
};
