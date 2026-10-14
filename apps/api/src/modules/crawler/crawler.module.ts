import { Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CrawlerCoreModule } from './crawler-core.module';
import { CrawlerController } from './crawler.controller';
import { CRAWLER_QUEUE } from './crawler.constants';
import { CrawlerRunControl } from './services/crawler-run-control.service';
import { CRAWLER_DISPATCHER } from './dispatchers/crawler-dispatcher.interface';
import { BullmqCrawlerDispatcher } from './dispatchers/bullmq-crawler.dispatcher';
import { InlineCrawlerDispatcher } from './dispatchers/inline-crawler.dispatcher';

/**
 * API 서버용 크롤러 모듈 (관리자 API + 수집 명령 전달).
 * 실제 수집과 정기 스케줄은 실행 환경(CRAWLER_DISPATCHER)에서 처리한다.
 */
@Module({
  imports: [
    CrawlerCoreModule,
    BullModule.registerQueue({ name: CRAWLER_QUEUE }),
  ],
  controllers: [CrawlerController],
  providers: [
    CrawlerRunControl,
    BullmqCrawlerDispatcher,
    InlineCrawlerDispatcher,
    {
      provide: CRAWLER_DISPATCHER,
      inject: [ConfigService, BullmqCrawlerDispatcher, InlineCrawlerDispatcher],
      useFactory: (
        configService: ConfigService,
        bullmq: BullmqCrawlerDispatcher,
        inline: InlineCrawlerDispatcher,
      ) => {
        const type = (
          configService.get<string>('CRAWLER_DISPATCHER') || 'bullmq'
        ).toLowerCase();
        new Logger(CrawlerModule.name).log(`Crawler dispatcher: ${type}`);
        switch (type) {
          case 'inline':
            return inline;
          case 'bullmq':
            return bullmq;
          default:
            throw new Error(
              `Unknown CRAWLER_DISPATCHER: ${type} (expected "bullmq" or "inline")`,
            );
        }
      },
    },
  ],
  exports: [CrawlerCoreModule],
})
export class CrawlerModule {}
