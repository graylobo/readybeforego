/**
 * 관리자 대시보드의 기간 계산 (한국 시간 기준).
 * DB의 created_at은 시간대 없는 UTC 시각이라, 날짜 경계는 KST 0시를 UTC로 바꿔 비교하고
 * 날짜별 묶음은 created_at + 9시간의 날짜로 센다.
 */

export const DASHBOARD_RANGE_DAYS = [1, 7, 30] as const;
export type DashboardRangeDays = (typeof DASHBOARD_RANGE_DAYS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** 추이 그래프는 최소 이만큼의 날을 그린다 ("오늘"을 골라도 한 점짜리 그래프가 되지 않게) */
const MIN_SERIES_DAYS = 7;

export interface DashboardRange {
  days: DashboardRangeDays;
  /** 이번 기간: start ~ now */
  start: Date;
  now: Date;
  /** 지난 기간: 이번 기간을 기간 길이만큼 앞으로 옮긴 같은 길이 (지금 시점까지 비교해 공평하게) */
  previousStart: Date;
  previousEnd: Date;
  /** 추이 그래프의 날짜들 (KST, 오래된 순, 오늘 포함) */
  seriesDates: string[];
}

export function parseRangeDays(value: unknown): DashboardRangeDays {
  const days = Number(value);
  return (DASHBOARD_RANGE_DAYS as readonly number[]).includes(days)
    ? (days as DashboardRangeDays)
    : 7;
}

/** 한국 날짜 (YYYY-MM-DD) */
export function toKstDate(at: Date) {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 한국 날짜로 오늘 0시 */
export function kstMidnight(at: Date) {
  return new Date(`${toKstDate(at)}T00:00:00+09:00`);
}

/** days=1이면 오늘 0시부터, 7이면 6일 전 0시부터 지금까지 */
export function getDashboardRange(
  days: DashboardRangeDays,
  now: Date = new Date(),
): DashboardRange {
  const start = new Date(kstMidnight(now).getTime() - (days - 1) * DAY_MS);
  const shift = days * DAY_MS;
  const seriesDays = Math.max(days, MIN_SERIES_DAYS);
  const seriesDates = Array.from({ length: seriesDays }, (_, i) =>
    toKstDate(new Date(now.getTime() - (seriesDays - 1 - i) * DAY_MS)),
  );
  return {
    days,
    start,
    now,
    previousStart: new Date(start.getTime() - shift),
    previousEnd: new Date(now.getTime() - shift),
    seriesDates,
  };
}

/** 날짜별 개수를 그래프 날짜 순서대로 (없는 날은 0) */
export function fillSeries(
  dates: string[],
  rows: { date: string; count: number }[],
): number[] {
  const byDate = new Map(rows.map((r) => [r.date, Number(r.count)]));
  return dates.map((date) => byDate.get(date) ?? 0);
}
