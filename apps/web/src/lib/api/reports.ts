import { CreateReportRequest, Report, ResolveReportRequest } from '@community/shared-types';
import { apiClient } from '../api-client';

export const reportsApi = {
  createReport: (data: CreateReportRequest) =>
    apiClient.post<Report>('/reports', data).then((res) => res.data),

  getReports: (page = 1, limit = 20, status?: string, targetType?: string) =>
    apiClient
      .get<{ items: any[]; total: number }>('/reports/admin', { params: { page, limit, status, targetType } })
      .then((res) => res.data),

  resolveReport: (id: string, data: ResolveReportRequest) =>
    apiClient.patch<Report>(`/reports/admin/${id}`, data).then((res) => res.data),
};
