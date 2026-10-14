import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsModule } from '../uploads/uploads.module';
import { RedisModule } from '../redis/redis.module';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { LlmRewriterService } from './services/llm-rewriter.service';
import { CrawlerService } from './services/crawler.service';
import { CrawlerRunRegistry } from './services/crawler-run-registry.service';
import { CrawlerRunner } from './services/crawler-runner.service';
import { CrawlerSettingsRepository } from './crawler-settings.repository';

/**
 * 수집 로직 + 실행 상태 관리. API(CrawlerModule)와 실행 환경(워커, Job) 양쪽에서 공유한다.
 */
@Module({
  imports: [ConfigModule, UploadsModule, RedisModule],
  providers: [
    GeminiProvider,
    OpenAIProvider,
    LlmRewriterService,
    CrawlerService,
    CrawlerRunRegistry,
    CrawlerRunner,
    CrawlerSettingsRepository,
  ],
  exports: [
    CrawlerService,
    LlmRewriterService,
    CrawlerRunRegistry,
    CrawlerRunner,
    CrawlerSettingsRepository,
  ],
})
export class CrawlerCoreModule {}
