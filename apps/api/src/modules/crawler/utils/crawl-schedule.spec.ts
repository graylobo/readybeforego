import { normalizeIntervalRange, pickNextCrawlAt, planScheduledRun, SCHEDULE_TICK_MS } from './crawl-schedule';

const MINUTE = 60_000;

describe('crawl-schedule', () => {
  const now = Date.UTC(2026, 9, 13, 12, 0, 0);

  it('다음 수집 시각은 주기 범위 안에서 무작위 (초 단위까지)', () => {
    const gaps = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const gap = pickNextCrawlAt(now, 5, 10).getTime() - now;
      expect(gap).toBeGreaterThanOrEqual(5 * MINUTE);
      expect(gap).toBeLessThanOrEqual(10 * MINUTE);
      gaps.add(Math.floor(gap / 1000));
    }
    expect(gaps.size).toBeGreaterThan(100);
  });

  it('최대가 없거나 최소 이하면 고정 주기', () => {
    expect(pickNextCrawlAt(now, 3, null).getTime() - now).toBe(3 * MINUTE);
    expect(pickNextCrawlAt(now, 7, 5).getTime() - now).toBe(7 * MINUTE);
    expect(normalizeIntervalRange(7, 5)).toEqual({ crawlIntervalMinutes: 7, crawlIntervalMaxMinutes: null });
    expect(normalizeIntervalRange(7, 7)).toEqual({ crawlIntervalMinutes: 7, crawlIntervalMaxMinutes: null });
    expect(normalizeIntervalRange(5, 10)).toEqual({ crawlIntervalMinutes: 5, crawlIntervalMaxMinutes: 10 });
  });

  it('[시작] 직후(기록 없음)는 바로 수집', () => {
    expect(planScheduledRun({ nowMs: now, lastCrawledAt: null, nextCrawlAt: null, intervalMinutes: 10 })).toEqual({
      due: true,
      dueAtMs: now,
      delayMs: 0,
    });
  });

  it('다음 수집 시각이 다음 검사 전이면 이번 검사가 그 시각까지 기다렸다 수집', () => {
    const plan = planScheduledRun({
      nowMs: now,
      lastCrawledAt: new Date(now - 6 * MINUTE),
      nextCrawlAt: new Date(now + 42_000),
      intervalMinutes: 5,
    });
    expect(plan).toEqual({ due: true, dueAtMs: now + 42_000, delayMs: 42_000 });
  });

  it('다음 수집 시각이 다음 검사 이후면 이번에는 안 함', () => {
    const plan = planScheduledRun({
      nowMs: now,
      lastCrawledAt: new Date(now - MINUTE),
      nextCrawlAt: new Date(now + SCHEDULE_TICK_MS),
      intervalMinutes: 5,
    });
    expect(plan.due).toBe(false);
  });

  it('검사가 늦어 시각이 지났으면 바로', () => {
    const plan = planScheduledRun({
      nowMs: now,
      lastCrawledAt: new Date(now - 10 * MINUTE),
      nextCrawlAt: new Date(now - 3_000),
      intervalMinutes: 5,
    });
    expect(plan).toEqual({ due: true, dueAtMs: now - 3_000, delayMs: 0 });
  });

  it('다음 수집 시각이 없으면 마지막 수집 + 최소 주기', () => {
    const plan = planScheduledRun({
      nowMs: now,
      lastCrawledAt: new Date(now - 4.5 * MINUTE),
      nextCrawlAt: null,
      intervalMinutes: 5,
    });
    expect(plan).toEqual({ due: true, dueAtMs: now + 30_000, delayMs: 30_000 });
  });

  it('연속으로 검사해도 각 수집 시각은 한 번의 검사만 맡는다', () => {
    const dueAt = now + 59_999;
    const tick1 = planScheduledRun({ nowMs: now, lastCrawledAt: new Date(now - MINUTE), nextCrawlAt: new Date(dueAt), intervalMinutes: 5 });
    const tick0 = planScheduledRun({ nowMs: now - SCHEDULE_TICK_MS, lastCrawledAt: new Date(now - MINUTE), nextCrawlAt: new Date(dueAt), intervalMinutes: 5 });
    expect(tick1.due).toBe(true);
    expect(tick0.due).toBe(false);
  });
});
