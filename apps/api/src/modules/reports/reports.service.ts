import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ReportsRepository } from './reports.repository';
import { CreateReportRequest, ResolveReportRequest } from '@community/shared-types';

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepo: ReportsRepository) {}

  async createReport(data: CreateReportRequest, reporterId: string | null) {
    if (reporterId) {
      const hasReported = await this.reportsRepo.hasUserReported(data.targetId, data.targetType, reporterId);
      if (hasReported) {
        throw new ConflictException('이미 신고한 대상입니다.');
      }
    }
    return this.reportsRepo.createReport({ ...data, reporterId });
  }

  async getReports(page: number, limit: number, status?: string, targetType?: string) {
    return this.reportsRepo.getReports({ page, limit, status, targetType });
  }

  async resolveReport(id: string, adminId: string, data: ResolveReportRequest) {
    const updated = await this.reportsRepo.resolveReport(id, adminId, data.status);
    if (!updated) {
      throw new NotFoundException('Report not found');
    }
    return updated;
  }
}
