import { NestFactory } from '@nestjs/core';
import { CrawlerRunJobModule } from './crawler-run.module';
import { CrawlerRunner } from '../modules/crawler/services/crawler-runner.service';
import { CrawlerCommand } from '../modules/crawler/interfaces/crawler-run.interface';

/**
 * 크롤러 단발 실행 (Cloud Run Jobs 등 1회 실행 후 종료되는 환경용 진입점)
 *
 *   crawler-run.js tick                → 정기 수집 검사 1회 (Cloud Scheduler로 1분마다 실행)
 *   CRAWLER_COMMAND='{"type":"target","targetId":"...","runId":"..."}' crawler-run.js
 *                                      → API가 예약하고 전달한 명령 실행
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(CrawlerRunJobModule, {
    logger: ['log', 'warn', 'error'],
  });

  let exitCode = 0;
  try {
    const runner = app.get(CrawlerRunner);
    if (process.argv[2] === 'tick') {
      await runner.runScheduledTick();
    } else if (process.env.CRAWLER_COMMAND) {
      await runner.execute(
        JSON.parse(process.env.CRAWLER_COMMAND) as CrawlerCommand,
      );
    } else {
      throw new Error(
        'Usage: crawler-run tick | CRAWLER_COMMAND=<json> crawler-run',
      );
    }
  } catch (error) {
    console.error('❌ Crawler run failed:', error);
    exitCode = 1;
  } finally {
    await app.close();
    process.exit(exitCode);
  }
}

void bootstrap();
