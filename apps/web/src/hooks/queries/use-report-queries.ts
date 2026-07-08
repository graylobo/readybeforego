import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api/reports';
import { CreateReportRequest, ResolveReportRequest } from '@community/shared-types';

export const reportKeys = {
  all: ['reports'] as const,
  list: (filters: { page: number; limit: number; status?: string; targetType?: string }) =>
    [...reportKeys.all, 'list', filters] as const,
};

export function useCreateReport() {
  return useMutation({
    mutationFn: (data: CreateReportRequest) => reportsApi.createReport(data),
  });
}

export function useAdminReports(page: number, limit: number, status?: string, targetType?: string) {
  return useQuery({
    queryKey: reportKeys.list({ page, limit, status, targetType }),
    queryFn: () => reportsApi.getReports(page, limit, status, targetType),
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResolveReportRequest }) =>
      reportsApi.resolveReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}
