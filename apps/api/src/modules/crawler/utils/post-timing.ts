/**
 * 수집한 글의 등록 시각 정하기.
 * - 순서 유지(ordered): 디시 순서대로 시각이 커진다. 글 사이 간격은 무작위(일정한 간격은 사람이 쓴 글처럼 보이지 않음).
 *   앞서 그 게시판에 등록한 봇 글보다 과거가 되지 않아서, 1개씩 수집해도 순서가 유지된다.
 * - 섞기(shuffled): 글마다 범위 안에서 따로 시각을 뽑아 순서가 섞인다.
 * - 실시간 등록(범위 0~0)은 "방금 전" 근처라 섞을 여지가 없어 항상 순서 유지.
 */
export type PostOrderMode = 'ordered' | 'shuffled';

export const POST_ORDER_MODES: readonly PostOrderMode[] = ['ordered', 'shuffled'];

export function toPostOrderMode(value: unknown): PostOrderMode {
  return value === 'shuffled' ? 'shuffled' : 'ordered';
}

/**
 * 수집 방향: 'newest'(1페이지 위쪽, 최신 글부터) | 'oldest'(끝 페이지 아래쪽, 예전 글부터).
 * 예전 글부터면 여러 번에 걸쳐 수집해도 디시 시간 순서대로 쌓인다 (대신 최신 글은 늦게 들어온다)
 */
export type CrawlDirection = 'newest' | 'oldest';

export function toCrawlDirection(value: unknown): CrawlDirection {
  return value === 'oldest' ? 'oldest' : 'newest';
}

/** 같은 글은 이 횟수만큼 실패하면 더 시도하지 않는다 (AI가 응답했는데 검증에 계속 걸리는 글이 매번 AI 비용을 쓰지 않게) */
export const MAX_POST_ATTEMPTS = 3;
/** AI 자체를 못 쓴 실패(키 없음, 모델 모두 실패)는 글 탓이 아니고 비용도 안 들어 위 횟수에 세지 않는다 */
export const AI_UNAVAILABLE_PREFIX = '[AI 사용 불가] ';

const MINUTE = 60_000;
type Random = () => number;

const randomBetween = (low: number, high: number, random: Random) => low + random() * (high - low);

export interface TimingPlanInput {
  /** 이번에 등록할 글 수 */
  count: number;
  /** 등록 시간 범위(분 전). 둘 다 0이면 실시간 */
  minMinutes: number;
  maxMinutes: number;
  mode: PostOrderMode;
  random?: Random;
}

export interface TimingPlan {
  isRealtime: boolean;
  mode: PostOrderMode;
  /** 글별(오래된 글 → 최신 글 순서) "등록하는 순간으로부터 얼마나 과거로 할지" (ms) */
  offsetsMs: number[];
}

export function planPostTiming({ count, minMinutes, maxMinutes, mode, random = Math.random }: TimingPlanInput): TimingPlan {
  const low = Math.max(0, Math.min(minMinutes, maxMinutes));
  const high = Math.max(0, minMinutes, maxMinutes);
  const isRealtime = high === 0;
  const effectiveMode: PostOrderMode = isRealtime ? 'ordered' : mode;

  if (effectiveMode === 'shuffled') {
    return { isRealtime, mode: effectiveMode, offsetsMs: Array.from({ length: count }, () => randomBetween(low * MINUTE, high * MINUTE, random)) };
  }

  // 최신 글부터 거꾸로 쌓는다: 최신 글은 기준 시간, 과거 글일수록 무작위 간격만큼 더 과거
  const offsetsMs = new Array<number>(count);
  let offset = isRealtime ? 0 : randomBetween(low * MINUTE, high * MINUTE, random);
  for (let i = count - 1; i >= 0; i--) {
    offsetsMs[i] = offset;
    // 간격: 실시간 30초~2분, 과거 분산 1~5분
    offset += isRealtime ? randomBetween(30_000, 2 * MINUTE, random) : randomBetween(MINUTE, 5 * MINUTE, random);
  }
  return { isRealtime, mode: effectiveMode, offsetsMs };
}

/**
 * 실제로 등록하는 순간의 시각을 정한다.
 * 순서 유지면 floorMs(그 게시판의 마지막 봇 글 시각)보다 뒤로, 그러나 지금보다 미래는 아니게.
 */
export function resolvePostCreatedAt({ nowMs, offsetMs, mode, floorMs, random = Math.random }: {
  nowMs: number;
  offsetMs: number;
  mode: PostOrderMode;
  floorMs?: number | null;
  random?: Random;
}): Date {
  let time = nowMs - offsetMs;
  if (mode === 'ordered' && floorMs != null && time <= floorMs) {
    // 앞 글과 지금 사이(앞쪽 절반)에 무작위로 놓는다. 앞 글 바로 뒤에 몰려 일정한 간격이 되지 않게
    time = Math.min(nowMs, floorMs + Math.max(20_000, random() * ((nowMs - floorMs) / 2)));
  }
  return new Date(Math.floor(time));
}
