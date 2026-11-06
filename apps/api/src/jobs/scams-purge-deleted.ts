import { NestFactory } from '@nestjs/core';
import { ScamsPurgeDeletedJobModule } from './scams-purge-deleted.module';
import { ScamsService } from '../modules/scams/scams.service';

/**
 * 사용자가 지운 지 보관 기간이 지난 제보를 사진과 함께 영구 삭제 (매일 1회 실행)
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ScamsPurgeDeletedJobModule, {
    logger: ['log', 'warn', 'error'],
  });

  let exitCode = 0;
  try {
    const { foundCount, purgedCount } = await app.get(ScamsService).purgeExpiredDeletedScams();
    console.log(`✅ Purged ${purgedCount}/${foundCount} deleted scams`);
    if (purgedCount < foundCount) exitCode = 1;
  } catch (error) {
    console.error('❌ Purging deleted scams failed:', error);
    exitCode = 1;
  } finally {
    await app.close();
    process.exit(exitCode);
  }
}

bootstrap();
