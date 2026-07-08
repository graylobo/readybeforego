export type ReportTargetType = 'POST' | 'COMMENT';
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
}

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
}

export interface ResolveReportRequest {
  status: 'resolved' | 'rejected';
}
