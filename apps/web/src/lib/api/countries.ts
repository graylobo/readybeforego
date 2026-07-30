import { apiClient } from '../api-client';

export interface CountryItem {
  code: string;
  name: string;
  nameEn: string;
  emoji?: string;
  plug?: string;
  visa?: string;
  currency?: string;
  currencyCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const countriesApi = {
  getAllCountries: async (search?: string): Promise<CountryItem[]> => {
    const response = await apiClient.get('/countries', {
      params: { search },
    });
    return response.data;
  },

  getCountryByCode: async (code: string): Promise<CountryItem> => {
    const response = await apiClient.get(`/countries/${code}`);
    return response.data;
  },

  createCountry: async (dto: Partial<CountryItem>): Promise<CountryItem> => {
    const response = await apiClient.post('/countries', dto);
    return response.data;
  },

  updateCountry: async (code: string, dto: Partial<CountryItem>): Promise<CountryItem> => {
    const response = await apiClient.patch(`/countries/${code}`, dto);
    return response.data;
  },

  deleteCountry: async (code: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/countries/${code}`);
    return response.data;
  },
};
