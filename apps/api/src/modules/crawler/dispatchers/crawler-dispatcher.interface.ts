import { CrawlerCommand } from '../interfaces/crawler-run.interface';

export const CRAWLER_DISPATCHER = Symbol('CRAWLER_DISPATCHER');

/**
 * 수집 명령을 실제 실행 환경으로 넘기는 역할.
 * API는 이 인터페이스에만 의존하므로, 실행 환경을 바꿀 때는 구현체만 추가/교체하면 된다.
 *
 * - bullmq : Redis 큐에 넣고, 상시 가동 서버(pm2)의 크롤러 워커(src/crawler-worker.ts)가 처리 (기본값)
 * - inline : API 프로세스 안에서 바로 실행 (워커 없이 로컬 개발할 때)
 * - (예정) cloud-run-job : Cloud Run Jobs API로 Job 실행 (src/jobs/crawler-run.ts 를 Job 진입점으로 사용)
 *
 * 구현체는 명령 전달만 책임진다. 실행 락/중지/결과 저장은 실행 측의 CrawlerRunner가 처리한다.
 */
export interface CrawlerDispatcher {
  dispatch(command: CrawlerCommand): Promise<void>;
}
