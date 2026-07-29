import { apiClient } from '../api-client';

export interface CountryGuideItem {
  id: string;
  countryCode: string;
  category: 'pre_travel' | 'essentials' | 'baggage' | 'tips';
  title: string;
  description: string;
  icon?: string;
  isRequired: boolean;
  isCheckable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CountryUserTip {
  id: string;
  countryCode: string;
  userId?: string;
  content: string;
  likeCount: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    picture?: string;
  };
}

export interface CountryGuideData {
  guides: CountryGuideItem[];
  userTips: CountryUserTip[];
}

export interface AvailableCountryGuide {
  countryCode: string;
  countryName: string;
  countryNameEn: string;
  flagEmoji?: string;
  count: number;
}

export const guidesApi = {
  getAvailableCountries: async (): Promise<AvailableCountryGuide[]> => {
    const response = await apiClient.get('/guides/countries');
    return response.data;
  },

  getGuidesByCountry: async (countryCode: string): Promise<CountryGuideData> => {
    const response = await apiClient.get(`/guides/country/${countryCode}`);
    return response.data;
  },

  // 어드민 전용 CRUD API
  createGuide: async (dto: Partial<CountryGuideItem>): Promise<CountryGuideItem> => {
    const response = await apiClient.post('/guides/admin', dto);
    return response.data;
  },

  updateGuide: async (id: string, dto: Partial<CountryGuideItem>): Promise<CountryGuideItem> => {
    const response = await apiClient.patch(`/guides/admin/${id}`, dto);
    return response.data;
  },

  deleteGuide: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/guides/admin/${id}`);
    return response.data;
  },

  createUserTip: async (countryCode: string, content: string): Promise<CountryUserTip> => {
    const response = await apiClient.post('/guides/tips', { countryCode, content });
    return response.data;
  },

  likeUserTip: async (tipId: string): Promise<CountryUserTip> => {
    const response = await apiClient.post(`/guides/tips/${tipId}/like`);
    return response.data;
  },

  deleteUserTip: async (tipId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/guides/tips/${tipId}`);
    return response.data;
  },
};
