import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api/settings';
import { UpdateSiteSettingsRequest } from '@community/shared-types';

export const siteKeys = {
  all: ['site'] as const,
  settings: () => [...siteKeys.all, 'settings'] as const,
};

export function useSiteSettings() {
  return useQuery({
    queryKey: siteKeys.settings(),
    queryFn: () => settingsApi.getSettings(),
    staleTime: 1000 * 60 * 60, // 1 hour caches globally
  });
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSiteSettingsRequest) => settingsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siteKeys.settings() });
    },
  });
}
