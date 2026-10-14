import { planPostTiming, resolvePostCreatedAt, toPostOrderMode } from './post-timing';

const MINUTE = 60_000;

/** 큐 순서(오래된 글 → 최신 글)대로 차례로 등록했을 때의 시각 */
function simulate(plan: ReturnType<typeof planPostTiming>, startMs: number, floorMs: number | null, stepMs = 5_000) {
  const times: number[] = [];
  let floor = floorMs;
  plan.offsetsMs.forEach((offsetMs, i) => {
    const t = resolvePostCreatedAt({ nowMs: startMs + i * stepMs, offsetMs, mode: plan.mode, floorMs: floor }).getTime();
    times.push(t);
    floor = t;
  });
  return times;
}

const increasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]);

describe('post-timing', () => {
  const now = Date.UTC(2026, 9, 13, 12, 0, 0);

  it('순서 유지: 묶음 안에서 시각이 디시 순서대로 커지고, 최신 글은 범위 안', () => {
    for (let run = 0; run < 200; run++) {
      const plan = planPostTiming({ count: 5, minMinutes: 0, maxMinutes: 30, mode: 'ordered' });
      const times = simulate(plan, now, null, 0);
      expect(increasing(times)).toBe(true);
      expect(now - times[4]).toBeLessThanOrEqual(30 * MINUTE);
    }
  });

  it('순서 유지: 간격이 일정하지 않다 (1~5분 사이 무작위)', () => {
    const plan = planPostTiming({ count: 6, minMinutes: 10, maxMinutes: 20, mode: 'ordered' });
    const gaps = plan.offsetsMs.slice(0, -1).map((o, i) => o - plan.offsetsMs[i + 1]);
    gaps.forEach((g) => { expect(g).toBeGreaterThanOrEqual(MINUTE); expect(g).toBeLessThanOrEqual(5 * MINUTE); });
    expect(new Set(gaps.map(Math.round)).size).toBeGreaterThan(1);
  });

  it('순서 유지 + 1개씩 수집: 다음 수집 글이 앞 글보다 과거가 되지 않는다', () => {
    let floor: number | null = null;
    const all: number[] = [];
    for (let run = 0; run < 100; run++) {
      const plan = planPostTiming({ count: 1, minMinutes: 0, maxMinutes: 30, mode: 'ordered' });
      const [t] = simulate(plan, now + run * 10 * MINUTE, floor);
      all.push(t);
      floor = t;
    }
    expect(increasing(all)).toBe(true);
    all.forEach((t, run) => expect(t).toBeLessThanOrEqual(now + run * 10 * MINUTE));
  });

  it('섞기: 묶음 안에서도 순서가 섞이고, 모두 범위 안', () => {
    let shuffledSeen = false;
    for (let run = 0; run < 50; run++) {
      const plan = planPostTiming({ count: 5, minMinutes: 0, maxMinutes: 30, mode: 'shuffled' });
      const times = simulate(plan, now, now - 5 * MINUTE, 0);
      times.forEach((t) => { expect(now - t).toBeGreaterThanOrEqual(0); expect(now - t).toBeLessThanOrEqual(30 * MINUTE); });
      if (!increasing(times)) shuffledSeen = true;
    }
    expect(shuffledSeen).toBe(true);
  });

  it('실시간 등록은 섞기를 골라도 순서 유지, 최신 글은 방금 전', () => {
    const plan = planPostTiming({ count: 4, minMinutes: 0, maxMinutes: 0, mode: 'shuffled' });
    expect(plan).toMatchObject({ isRealtime: true, mode: 'ordered' });
    const times = simulate(plan, now, null, 0);
    expect(increasing(times)).toBe(true);
    expect(times[3]).toBe(now);
  });

  it('미래 시각은 만들지 않는다 (마지막 봇 글이 방금 전이어도)', () => {
    const t = resolvePostCreatedAt({ nowMs: now, offsetMs: 0, mode: 'ordered', floorMs: now - 1000 }).getTime();
    expect(t).toBeLessThanOrEqual(now);
  });

  it('알 수 없는 값은 순서 유지', () => {
    expect(toPostOrderMode('shuffled')).toBe('shuffled');
    expect(toPostOrderMode('x')).toBe('ordered');
    expect(toPostOrderMode(undefined)).toBe('ordered');
  });
});
