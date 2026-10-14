import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlerRunner } from '../services/crawler-runner.service';

/**
 * 상시 가동 워커에서 매 1분마다 정기 수집 검사
 * (Cloud Scheduler + Cloud Run Jobs로 옮길 경우 src/jobs/crawler-run.ts tick 을 1분 주기로 실행하면 동일하게 동작)
 */
@Injectable()
export class CrawlerScheduler {
  constructor(private readonly runner: CrawlerRunner) {}

  @Cron(CronExpression.EVERY_MINUTE)
  handleScheduledCrawl() {
    // 수집이 끝날 때까지 기다리지 않음 (진행 중인 타겟은 다음 검사에서 실행 락으로 건너뜀)
    void this.runner.runScheduledTick();
  }
}
