import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CRAWLER_QUEUE } from '../crawler.constants';
import { CrawlerCommand } from '../interfaces/crawler-run.interface';
import { CrawlerDispatcher } from './crawler-dispatcher.interface';

/**
 * Redis 큐(BullMQ)로 명령 전달 → 크롤러 워커(src/crawler-worker.ts)의 CrawlerProcessor가 처리
 */
@Injectable()
export class BullmqCrawlerDispatcher implements CrawlerDispatcher {
  constructor(
    @InjectQueue(CRAWLER_QUEUE) private readonly queue: Queue<CrawlerCommand>,
  ) {}

  async dispatch(command: CrawlerCommand): Promise<void> {
    await this.queue.add(command.type, command, {
      // runId 단위로 중복 등록 방지
      jobId: command.runId,
      // 재시도하지 않음 (실행 상태/결과는 CrawlerRunRegistry가 관리)
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
