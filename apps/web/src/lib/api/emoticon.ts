import { apiClient } from '../api-client';
import { EmoticonPack, CreateEmoticonPackDto } from '@community/shared-types';
export type { EmoticonPack };

export const emoticonApi = {
  // --- Shop ---
  getEmoticonPacks: async (params?: {
    page?: number;
    limit?: number;
    q?: string;
    sortBy?: 'latest' | 'sales';
  }): Promise<{ items: EmoticonPack[]; total: number }> => {
    const response = await apiClient.get('/emoticons', { params });
    return response.data;
  },

  getEmoticonPack: async (id: string): Promise<EmoticonPack> => {
    const response = await apiClient.get(`/emoticons/${id}`);
    return response.data;
  },

  getPackByUrl: async (url: string): Promise<{ packId: string; pack: EmoticonPack }> => {
    const response = await apiClient.get('/emoticons/by-url', { params: { url } });
    return response.data;
  },

  // --- Purchase ---
  purchasePack: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/emoticons/${id}/purchase`);
    return response.data;
  },

  // --- My Packs ---
  getMyPurchasedPacks: async (params?: { page?: number; limit?: number }): Promise<{ items: any[]; total: number }> => {
    const response = await apiClient.get('/emoticons/my/purchased', { params });
    return response.data;
  },

  getMyCreatedPacks: async (params?: { page?: number; limit?: number }): Promise<{ items: EmoticonPack[]; total: number }> => {
    const response = await apiClient.get('/emoticons/my/created', { params });
    return response.data;
  },

  // --- Create & Edit ---
  createEmoticonPack: async (data: CreateEmoticonPackDto): Promise<EmoticonPack> => {
    const response = await apiClient.post('/emoticons', data);
    return response.data;
  },

  updateEmoticonPack: async (id: string, data: CreateEmoticonPackDto): Promise<EmoticonPack> => {
    const response = await apiClient.put(`/emoticons/${id}`, data);
    return response.data;
  },

  // --- Admin ---
  adminUpdateStatus: async (id: string, data: { status: 'approved' | 'rejected' | 'pending'; rejectionReason?: string }) => {
    const response = await apiClient.put(`/emoticons/${id}/status`, data);
    return response.data;
  },

  adminUpdatePrice: async (id: string, price: number) => {
    const response = await apiClient.put(`/emoticons/${id}/price`, { price });
    return response.data;
  },

  adminGetAllPacks: async (params?: { page?: number; limit?: number; status?: string; q?: string }): Promise<{ items: EmoticonPack[]; total: number }> => {
    const response = await apiClient.get('/emoticons', { params });
    return response.data;
  },

  // --- Delete ---
  deletePack: async (id: string) => {
    const response = await apiClient.delete(`/emoticons/${id}`);
    return response.data;
  },

  adminForceDelete: async (id: string) => {
      const response = await apiClient.delete(`/emoticons/${id}/force`);
      return response.data;
  },

  restorePack: async (id: string) => {
      const response = await apiClient.post(`/emoticons/${id}/restore`);
      return response.data;
  },
};
