import { apiClient } from '../api-client';

export interface Country {
  code: string;
  name: string;
  nameEn: string;
  createdAt: string;
  updatedAt: string;
}

export interface City {
  id: string;
  countryCode: string;
  name: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface Region {
  id: string;
  cityId: string;
  name: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  cityName?: string;
  countryCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScamInfo {
  id: string;
  regionId: string;
  title: string;
  description: string;
  avoidanceTip?: string | null;
  scamCategory: string;
  sourceUrl?: string | null;
  viewCount: number;
  upvoteCount: number;
  downvoteCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  reactions?: Array<{ id: string; type: 'like' | 'dislike' }>;
}

export const scamsApi = {
  getCountries: async (): Promise<Country[]> => {
    const response = await apiClient.get('/scams/countries');
    return response.data;
  },

  getCities: async (countryCode: string): Promise<City[]> => {
    const response = await apiClient.get(`/scams/cities/${countryCode}`);
    return response.data;
  },

  getRegions: async (cityId: string): Promise<Region[]> => {
    const response = await apiClient.get(`/scams/regions/${cityId}`);
    return response.data;
  },

  getAllRegions: async (): Promise<Region[]> => {
    const response = await apiClient.get('/scams/regions/all');
    return response.data;
  },

  getScamsByRegion: async (regionId: string): Promise<ScamInfo[]> => {
    const response = await apiClient.get(`/scams/region/${regionId}`);
    return response.data;
  },

  getScamById: async (id: string): Promise<ScamInfo> => {
    const response = await apiClient.get(`/scams/${id}`);
    return response.data;
  },

  createScam: async (data: {
    regionId: string;
    title: string;
    description: string;
    avoidanceTip?: string;
    scamCategory: string;
    sourceUrl?: string;
  }): Promise<ScamInfo> => {
    const response = await apiClient.post('/scams', data);
    return response.data;
  },

  toggleReaction: async (id: string, type: 'like' | 'dislike'): Promise<ScamInfo> => {
    const response = await apiClient.post(`/scams/${id}/reaction`, { type });
    return response.data;
  }
};
