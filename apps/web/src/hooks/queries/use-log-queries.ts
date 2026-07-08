import { useQuery } from '@tanstack/react-query';
import { logsApi } from '@/lib/api/logs';

export const logKeys = {
  all: ['logs'] as const,
  me: () => [...logKeys.all, 'me'] as const,
  admin: (page: number, limit: number) => [...logKeys.all, 'admin', { page, limit }] as const,
};

export function useMyLogs() {
  return useQuery({
    queryKey: logKeys.me(),
    queryFn: () => logsApi.getMyLogs(),
  });
}

export function useAdminLogs(page: number = 1, limit: number = 50) {
  return useQuery({
    queryKey: logKeys.admin(page, limit),
    queryFn: () => logsApi.getAdminLogs(page, limit),
  });
}
