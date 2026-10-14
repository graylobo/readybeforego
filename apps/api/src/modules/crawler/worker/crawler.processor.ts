import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  CRAWLER_QUEUE,
  CRAWLER_WORKER_CONCURRENCY,
} from '../crawler.constants';
import { CrawlerCommand } from '../interfaces/crawler-run.interface';
import { CrawlerRunner } from '../services/crawler-runner.service';

/**
 * API가 큐에 넣은 수집 명령(즉시 수집 / 일괄 수집) 처리
 */
@Processor(CRAWLER_QUEUE, { concurrency: CRAWLER_WORKER_CONCURRENCY })
export class CrawlerProcessor extends WorkerHost {
  constructor(private readonly runner: CrawlerRunner) {
    super();
  }

  async process(job: Job<CrawlerCommand>) {
    await this.runner.execute(job.data);
  }
}
