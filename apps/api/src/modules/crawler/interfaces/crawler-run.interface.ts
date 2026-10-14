export interface CrawlResult {
  collected: number;
  skipped: number;
  errors: number;
  cancelled: boolean;
  skipDetails: {
    alreadyCollected: number;
    imageFiltered: number;
    /** 제목이나 본문에 제외 키워드가 있는 글 */
    keywordFiltered: number;
    fetchFailed: number;
    /** '켠 이후 올라온 글만'일 때 켜기 전에 올라와 있던 글 */
    beforeStart: number;
    /** 이미 여러 번 실패해 더 시도하지 않은 글 */
    retryExhausted: number;
  };
  /** '켠 이후 올라온 글만'의 기준 글 번호를 이번에 정함 (이번에는 수집하지 않고 다음 수집부터 새 글을 가져옴) */
  baselineCaptured?: boolean;
}

export interface BatchCrawlResult {
  totalCollected: number;
  totalErrors: number;
  cancelled: boolean;
}

export const emptyCrawlResult = (cancelled = false): CrawlResult => ({
  collected: 0,
  skipped: 0,
  errors: 0,
  cancelled,
  skipDetails: { alreadyCollected: 0, imageFiltered: 0, keywordFiltered: 0, fetchFailed: 0, beforeStart: 0, retryExhausted: 0 },
});

/**
 * API → 실행 환경으로 전달되는 수집 명령.
 * runId는 CrawlerRunRegistry.reserve 로 예약된 실행 id이며, 실행 측은 이 runId로 claim 해야 한다.
 * (BullMQ job 데이터, Cloud Run Job 인자 등 어떤 전달 수단이든 이 형태 그대로 직렬화해 전달)
 */
export type CrawlerCommand =
  | { type: 'target'; targetId: string; runId: string }
  | { type: 'batch'; runId: string };
