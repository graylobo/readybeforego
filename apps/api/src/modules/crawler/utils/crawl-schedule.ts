/**
 * 정기 수집 시각 정하기.
 * 수집 주기는 '최소~최대' 범위이고, 수집할 때마다 다음 수집 시각을 그 범위에서 무작위로 뽑아 둔다
 * (매번 같은 간격으로 글이 올라오면 자동 등록으로 보이기 쉽다). 최소와 최대가 같으면 고정 주기.
 */
const MINUTE = 60_000;
type Random = () => number;

/** 정기 수집 검사 간격 (워커 프로그램이 1분마다 검사) */
export const SCHEDULE_TICK_MS = MINUTE;

export const DEFAULT_CRAWL_INTERVAL_MINUTES = 10;

/** 주기 범위 (분). 최대가 없거나 최소보다 작으면 최소와 같게 본다 */
export function resolveIntervalRange(minMinutes: number | null | undefined, maxMinutes: number | null | undefined) {
  const min = minMinutes && minMinutes > 0 ? minMinutes : DEFAULT_CRAWL_INTERVAL_MINUTES;
  const max = maxMinutes && maxMinutes > min ? maxMinutes : min;
  return { min, max };
}

/** 저장할 주기 값: 최대가 최소보다 크지 않으면 고정 주기(최대 비움) */
export function normalizeIntervalRange(minMinutes: number, maxMinutes: number | null | undefined) {
  const { min, max } = resolveIntervalRange(minMinutes, maxMinutes);
  return { crawlIntervalMinutes: min, crawlIntervalMaxMinutes: max > min ? max : null };
}

/** 수집 시작 시각으로부터 다음 수집 시각 (범위 안에서 초 단위까지 무작위) */
export function pickNextCrawlAt(
  fromMs: number,
  minMinutes: number | null | undefined,
  maxMinutes: number | null | undefined,
  random: Random = Math.random,
): Date {
  const { min, max } = resolveIntervalRange(minMinutes, maxMinutes);
  return new Date(Math.floor(fromMs + (min + random() * (max - min)) * MINUTE));
}

/**
 * 이번 검사에서 수집할지와, 수집한다면 몇 ms 기다렸다가 시작할지.
 * 다음 검사(1분 뒤)보다 먼저 돌아올 시각이면 이번 검사가 맡아 그 시각까지 기다린다
 * (1분 검사에 맞춰 시작하면 수집 시각의 '초'가 매번 같아진다).
 * - 다음 수집 시각이 있으면 그 시각
 * - 둘 다 없으면([시작] 직후) 바로
 * - 다음 수집 시각만 없으면(이 기능 전에 수집한 카드) 마지막 수집 + 최소 주기
 */
export function planScheduledRun({
  nowMs,
  lastCrawledAt,
  nextCrawlAt,
  intervalMinutes,
}: {
  nowMs: number;
  lastCrawledAt: Date | null;
  nextCrawlAt: Date | null;
  intervalMinutes: number | null | undefined;
}): { due: false } | { due: true; dueAtMs: number; delayMs: number } {
  const dueAtMs = nextCrawlAt
    ? nextCrawlAt.getTime()
    : lastCrawledAt
      ? lastCrawledAt.getTime() + resolveIntervalRange(intervalMinutes, null).min * MINUTE
      : nowMs;
  if (dueAtMs >= nowMs + SCHEDULE_TICK_MS) {
    return { due: false };
  }
  return { due: true, dueAtMs, delayMs: Math.max(0, dueAtMs - nowMs) };
}
