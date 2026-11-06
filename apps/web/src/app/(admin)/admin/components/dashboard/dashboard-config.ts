import type { DashboardRangeDays, DashboardSystemState } from '@/lib/api/admin';

/**
 * 대시보드 항목의 이름과 이동할 곳. 서버는 key만 내려주고, 여기 없는 key는 화면에 그리지 않는다.
 * 파생 프로젝트는 자기 항목을 여기에 더한다.
 */
export const TASK_META: Record<string, { label: string; href: string }> = {
  reports: { label: '신고 처리', href: '/admin/reports' },
  inquiries: { label: '1:1 문의 답변', href: '/admin/inquiries' },
  boardRequests: { label: '게시판 개설 신청', href: '/admin/board-requests' },
};

export const SYSTEM_META: Record<string, { label: string; href?: string }> = {
  crawler: { label: '콘텐츠 수집기', href: '/admin/crawler' },
};

export const RANGE_OPTIONS: { days: DashboardRangeDays; label: string; increaseLabel: string }[] = [
  { days: 1, label: '오늘', increaseLabel: '오늘' },
  { days: 7, label: '7일', increaseLabel: '최근 7일' },
  { days: 30, label: '30일', increaseLabel: '최근 30일' },
];

export const SYSTEM_STATE_META: Record<DashboardSystemState, { label: string; dot: string }> = {
  ok: { label: '정상', dot: 'bg-emerald-500' },
  warning: { label: '주의', dot: 'bg-amber-500' },
  error: { label: '문제', dot: 'bg-rose-500' },
  idle: { label: '꺼짐', dot: 'bg-muted-foreground/40' },
};

export const MODERATION_TYPE_META: Record<string, { label: string; className: string }> = {
  BAN: { label: '영구 정지', className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' },
  SUSPENSION: { label: '기간 정지', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  WARNING: { label: '경고', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  REACTIVATE: { label: '해제', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
};
