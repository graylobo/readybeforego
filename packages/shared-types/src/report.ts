export type ReportTargetType = 'POST' | 'COMMENT' | 'SCAM_INFO';
export type ReportStatus = 'pending' | 'resolved' | 'rejected';

export interface Report {
  id: string;
  reporterId: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  targetUrl?: string;
  /** 신고 대상이 지금은 지워졌거나 없음 */
  targetDeleted?: boolean;
}

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
}

export interface ResolveReportRequest {
  status: 'resolved' | 'rejected';
}
