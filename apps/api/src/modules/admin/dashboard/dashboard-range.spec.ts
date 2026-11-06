import {
  fillSeries,
  getDashboardRange,
  parseRangeDays,
  toKstDate,
} from './dashboard-range';

describe('dashboard-range', () => {
  // 한국 시간 2026-10-20 08:30 (UTC 10-19 23:30)
  const now = new Date('2026-10-19T23:30:00Z');

  it('한국 날짜로 센다', () => {
    expect(toKstDate(now)).toBe('2026-10-20');
  });

  it('오늘: 한국 시간 0시부터, 지난 기간은 어제 같은 시각까지', () => {
    const range = getDashboardRange(1, now);
    expect(range.start.toISOString()).toBe('2026-10-19T15:00:00.000Z');
    expect(range.previousStart.toISOString()).toBe('2026-10-18T15:00:00.000Z');
    expect(range.previousEnd.toISOString()).toBe('2026-10-18T23:30:00.000Z');
    // 하루짜리 기간도 추이는 7일
    expect(range.seriesDates).toHaveLength(7);
    expect(range.seriesDates.at(-1)).toBe('2026-10-20');
  });

  it('7일: 6일 전 0시부터, 그래프는 오래된 순', () => {
    const range = getDashboardRange(7, now);
    expect(range.start.toISOString()).toBe('2026-10-13T15:00:00.000Z');
    expect(range.previousStart.toISOString()).toBe('2026-10-06T15:00:00.000Z');
    expect(range.seriesDates[0]).toBe('2026-10-14');
    expect(range.seriesDates.at(-1)).toBe('2026-10-20');
  });

  it('30일은 추이도 30일', () => {
    expect(getDashboardRange(30, now).seriesDates).toHaveLength(30);
  });

  it('허용하지 않는 기간은 7일', () => {
    expect(parseRangeDays('30')).toBe(30);
    expect(parseRangeDays('2')).toBe(7);
    expect(parseRangeDays(undefined)).toBe(7);
  });

  it('없는 날은 0으로 채운다', () => {
    expect(
      fillSeries(
        ['2026-10-19', '2026-10-20'],
        [{ date: '2026-10-20', count: 3 }],
      ),
    ).toEqual([0, 3]);
  });
});
