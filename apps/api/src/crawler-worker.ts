import { NestFactory } from '@nestjs/core';
import { CrawlerWorkerAppModule } from './crawler-worker.module';

/**
 * 크롤러 워커 (상시 가동 서버에서 pm2 등으로 실행)
 * - API가 큐에 넣은 즉시 수집 / 일괄 수집 명령 처리
 * - 매 1분 정기 수집 검사
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    CrawlerWorkerAppModule,
    {
      logger: ['log', 'warn', 'error'],
    },
  );
  app.enableShutdownHooks();
  console.log('🚀 Crawler worker started');
}

void bootstrap();
