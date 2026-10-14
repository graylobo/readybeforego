import { apiClient } from '../api-client';

export interface CrawlerTarget {
  id: string;
  name: string;
  sourceType: string;
  galleryId: string;
  targetBoardId: string;
  category?: string | null;
  minRecommendCount: number;
  botUserId?: string | null;
  promptTone?: string | null;
  // 패러프레이징 시 그대로 유지할 단어 (쉼표/줄바꿈 구분, "단어=뜻" 형식 가능)
  preservedTerms?: string | null;
  // 제목이나 본문에 들어 있으면 수집하지 않을 단어 (쉼표/줄바꿈 구분)
  excludeKeywords?: string | null;
  isActive: boolean;
  collectLimit: number;
  enableComments: boolean;
  commentsCount: number;
  commentsCountMin: number;
  commentsCountMax: number;
  viewCountMin: number;
  viewCountMax: number;
  includeImages: boolean;
  authorMainKeywords?: string | null;
  authorSubKeywords?: string | null;
  authorUseSub: boolean;
  commentAuthorMainKeywords?: string | null;
  commentAuthorSubKeywords?: string | null;
  commentAuthorUseSub: boolean;
  timeJitterMinMinutes: number;
  timeJitterMaxMinutes: number;
  /** 등록 순서: 디시 순서대로(ordered) | 섞기(shuffled) */
  postOrderMode?: 'ordered' | 'shuffled';
  /** 켠 이후 올라온 글만 수집 */
  onlyNewPosts?: boolean;
  /** 그 기준이 되는 디시 글 번호 (서버가 정함) */
  newPostsAfterId?: number | null;
  /** 수집 방향: 최신 글부터(newest) | 예전 글부터(oldest) */
  crawlDirection?: 'newest' | 'oldest';
  pageMin: number;
  pageMax: number;
  /** 수집 주기(분). 최대가 있으면 매번 최소~최대 중 무작위 */
  crawlIntervalMinutes: number;
  crawlIntervalMaxMinutes?: number | null;
  autoStopMinutes: number;
  activatedAt?: string | null;
  lastCrawledAt?: string | null;
  /** 다음 정기 수집 예정 시각 (서버가 정함) */
  nextCrawlAt?: string | null;
  createdAt: string;
  updatedAt: string;
  targetBoard?: {
    id: string;
    slug: string;
    name: string;
  };
}

export interface CrawlerLog {
  id: string;
  // 수집 대상 카드가 삭제되면 null (이력은 남음)
  targetId: string | null;
  // 수집 당시 카드 이름
  targetName?: string | null;
  sourcePostId: string;
  sourceUrl: string;
  originalTitle: string;
  createdPostId?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  errorMessage?: string | null;
  createdAt: string;
  target?: CrawlerTarget;
  createdPost?: {
    id: string;
    title: string;
    boardId: string;
    // 상세 화면 등에서 지운 글 (이력은 남아 다시 수집되지 않음)
    deletedAt: string | null;
    // Super Admin이 비공개로 돌린 글
    hiddenAt: string | null;
    board: { slug: string } | null;
  } | null;
}

export interface CrawlResult {
  collected: number;
  skipped: number;
  errors: number;
  cancelled: boolean;
  skipDetails?: {
    alreadyCollected: number;
    imageFiltered: number;
    keywordFiltered?: number;
    fetchFailed: number;
    beforeStart?: number;
    retryExhausted?: number;
  };
  /** '켠 이후 올라온 글만'의 기준 글 번호를 이번에 정함 (이번에는 수집하지 않음) */
  baselineCaptured?: boolean;
}

export interface BatchCrawlResult {
  totalCollected: number;
  totalErrors: number;
  cancelled: boolean;
}

// queued: 워커가 아직 작업을 집어가지 않음, running: 수집 진행 중
export type CrawlerRunState = 'queued' | 'running';

export interface CrawlerRunStatus {
  running: {
    targetId: string;
    state: CrawlerRunState;
    isManual: boolean;
    startedAt: string;
    cancelRequested: boolean;
  }[];
  // 실행이 예외로 끝난 경우 error만 담긴다
  lastResults: Record<string, (CrawlResult | { error: string }) & { finishedAt: string }>;
  batch: { state: CrawlerRunState; startedAt: string; cancelRequested: boolean } | null;
  lastBatchResult: ((BatchCrawlResult | { error: string }) & { finishedAt: string }) | null;
}

// 수집 전체 공통 설정
export interface CrawlerSettings {
  id: string;
  // 모든 카드에 공통으로 적용되는 보존 단어 (같은 단어는 카드 쪽 뜻이 우선)
  preservedTerms: string | null;
  updatedAt: string;
}

export const crawlerApi = {
  getSettings: async (): Promise<CrawlerSettings> => {
    const response = await apiClient.get('/admin/crawler/settings');
    return response.data;
  },

  updateSettings: async (data: { preservedTerms: string | null }): Promise<CrawlerSettings> => {
    const response = await apiClient.patch('/admin/crawler/settings', data);
    return response.data;
  },

  getTargets: async (): Promise<CrawlerTarget[]> => {
    const response = await apiClient.get('/admin/crawler/targets');
    return response.data;
  },

  createTarget: async (data: Partial<CrawlerTarget>): Promise<CrawlerTarget> => {
    const response = await apiClient.post('/admin/crawler/targets', data);
    return response.data;
  },

  updateTarget: async (
    id: string,
    data: Partial<CrawlerTarget>,
  ): Promise<CrawlerTarget> => {
    const response = await apiClient.patch(`/admin/crawler/targets/${id}`, data);
    return response.data;
  },

  deleteTarget: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/admin/crawler/targets/${id}`);
    return response.data;
  },

  triggerTarget: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/admin/crawler/targets/${id}/trigger`);
    return response.data;
  },

  cancelTarget: async (id: string): Promise<{ cancelled: boolean }> => {
    const response = await apiClient.post(`/admin/crawler/targets/${id}/cancel`);
    return response.data;
  },

  getPostSource: async (
    postId: string,
  ): Promise<{ sourceUrl: string; originalTitle: string }> => {
    const response = await apiClient.get(`/admin/crawler/posts/${postId}/source`);
    return response.data;
  },

  getRunStatus: async (): Promise<CrawlerRunStatus> => {
    const response = await apiClient.get('/admin/crawler/status');
    return response.data;
  },

  triggerAll: async (): Promise<{ message: string }> => {
    const response = await apiClient.post('/admin/crawler/trigger-all');
    return response.data;
  },

  cancelAll: async (): Promise<{ cancelled: boolean }> => {
    const response = await apiClient.post('/admin/crawler/trigger-all/cancel');
    return response.data;
  },

  getLogs: async (): Promise<CrawlerLog[]> => {
    const response = await apiClient.get('/admin/crawler/logs');
    return response.data;
  },

  deleteLog: async (
    id: string,
  ): Promise<{ success: boolean; deletedImagesCount: number }> => {
    const response = await apiClient.delete(`/admin/crawler/logs/${id}`);
    return response.data;
  },

  deleteLogsBatch: async (
    logIds: string[],
  ): Promise<{
    success: boolean;
    deletedLogsCount: number;
    deletedPostsCount: number;
    deletedImagesCount: number;
  }> => {
    const response = await apiClient.post('/admin/crawler/logs/delete-batch', { logIds });
    return response.data;
  },
};
