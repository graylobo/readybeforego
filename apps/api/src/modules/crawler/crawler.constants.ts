export const CRAWLER_QUEUE = 'crawler';

// 동시에 처리할 수집 명령 수 (일괄 수집이 진행 중이어도 개별 즉시 수집이 대기하지 않도록 1보다 크게)
export const CRAWLER_WORKER_CONCURRENCY = 4;
