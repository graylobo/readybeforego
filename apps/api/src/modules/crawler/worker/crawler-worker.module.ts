import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CrawlerCoreModule } from '../crawler-core.module';
import { CRAWLER_QUEUE } from '../crawler.constants';
import { CrawlerProcessor } from './crawler.processor';
import { CrawlerScheduler } from './crawler.scheduler';

/**
 * 상시 가동 크롤러 워커용 모듈 (큐 명령 처리 + 정기 수집 스케줄)
 */
@Module({
  imports: [
    CrawlerCoreModule,
    BullModule.registerQueue({ name: CRAWLER_QUEUE }),
  ],
  providers: [CrawlerProcessor, CrawlerScheduler],
})
export class CrawlerWorkerModule {}
