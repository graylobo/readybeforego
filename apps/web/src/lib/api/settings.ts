import { SiteSettings, UpdateSiteSettingsRequest } from '@community/shared-types';
import { apiClient } from '../api-client';

export const settingsApi = {
  getSettings: () => apiClient.get<SiteSettings>('/settings').then((res: any) => res.data),
  updateSettings: (data: UpdateSiteSettingsRequest) =>
    apiClient.patch<SiteSettings>('/settings', data).then((res: any) => res.data),
};
