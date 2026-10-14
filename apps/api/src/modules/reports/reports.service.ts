import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ReportsRepository } from './reports.repository';
import { CreateReportRequest, ResolveReportRequest } from '@community/shared-types';

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepo: ReportsRepository) {}

  async createReport(data: CreateReportRequest, reporterId: string | null) {
    // 없거나 이미 지워진 글/댓글은 신고를 받지 않는다 (관리자 목록에 처리할 수 없는 신고가 쌓이지 않도록)
    if (!(await this.reportsRepo.targetExists(data.targetType, data.targetId))) {
      throw new NotFoundException('신고할 대상을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
    }
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
