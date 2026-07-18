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
  cityName?: string | null;
  countryCode?: string | null;
  scamCount?: number;
  hasRegionScope?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScamInfo {
  id: string;
  regionId?: string | null;
  cityId?: string | null;
  countryCode?: string | null;
  scope: 'spot' | 'region' | 'city' | 'country';
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
  imageUrls?: string[] | null;
  commentCount?: number;
  userId?: string | null;
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

  getScamsByCity: async (cityId: string): Promise<ScamInfo[]> => {
    const response = await apiClient.get(`/scams/city/${cityId}`);
    return response.data;
  },

  getScamsByCountry: async (countryCode: string): Promise<ScamInfo[]> => {
    const response = await apiClient.get(`/scams/country/${countryCode}`);
    return response.data;
  },

  getScamById: async (id: string): Promise<ScamInfo> => {
    const response = await apiClient.get(`/scams/${id}`);
    return response.data;
  },

  createScam: async (data: {
    regionId?: string;
    regionName?: string;
    cityId?: string;
    countryCode?: string;
    countryName?: string;
    cityName?: string;
    latitude?: number;
    longitude?: number;
    scope?: 'spot' | 'region' | 'city' | 'country';
    title: string;
    description: string;
    avoidanceTip?: string;
    scamCategory: string;
    sourceUrl?: string;
    imageUrls?: string[];
  }): Promise<ScamInfo> => {
    const response = await apiClient.post('/scams', data);
    return response.data;
  },

  updateScam: async (
    id: string,
    data: Partial<{
      regionId?: string;
      regionName?: string;
      cityId?: string;
      countryCode?: string;
      countryName?: string;
      cityName?: string;
      latitude?: number;
      longitude?: number;
      title: string;
      description: string;
      avoidanceTip?: string;
      scamCategory: string;
      sourceUrl?: string;
      imageUrls?: string[];
    }>
  ): Promise<ScamInfo> => {
    const response = await apiClient.patch(`/scams/${id}`, data);
    return response.data;
  },

  deleteScam: async (id: string): Promise<void> => {
    await apiClient.delete(`/scams/${id}`);
  },

  toggleReaction: async (id: string, type: 'like' | 'dislike'): Promise<ScamInfo> => {
    const response = await apiClient.post(`/scams/${id}/reaction`, { type });
    return response.data;
  },

  reverseGeocode: async (lat: number, lng: number): Promise<any> => {
    const response = await apiClient.get('/scams/reverse-geocode', { params: { lat, lng } });
    return response.data;
  },

  searchAddress: async (q: string): Promise<any[]> => {
    const response = await apiClient.get('/scams/search-address', { params: { q } });
    return response.data;
  }
};
