import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api/settings';
import { SiteSettings, UpdateSiteSettingsRequest } from '@community/shared-types';

export const siteKeys = {
  all: ['site'] as const,
  settings: () => [...siteKeys.all, 'settings'] as const,
};

export function useSiteSettings(initialData?: SiteSettings) {
  return useQuery({
    queryKey: siteKeys.settings(),
    queryFn: () => settingsApi.getSettings(),
    // 서버에서 받은 설정으로 바로 그리되, 오래됐을 수 있으니 화면이 뜨면 다시 받는다
    initialData,
    initialDataUpdatedAt: 0,
    staleTime: 1000 * 60 * 60, // 1 hour caches globally
  });
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSiteSettingsRequest) => settingsApi.updateSettings(data),
    onSuccess: (data) => {
      queryClient.setQueryData(siteKeys.settings(), data);
    },
  });
}
