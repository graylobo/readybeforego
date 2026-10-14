import { NestFactory } from '@nestjs/core';
import { UploadsTempCleanupJobModule } from './uploads-temp-cleanup.module';
import { UploadsCleanupService } from '../modules/uploads/services/uploads-cleanup.service';

/**
 * 게시글에 사용되지 않은 temp 업로드 파일 정리 (매일 1회 실행)
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(UploadsTempCleanupJobModule, {
    logger: ['log', 'warn', 'error'],
  });

  let exitCode = 0;
  try {
    console.log('🚀 Starting temp uploads cleanup...');
    await app.get(UploadsCleanupService).handleCleanup();
    console.log('✅ Temp uploads cleanup completed');
  } catch (error) {
    console.error('❌ Temp uploads cleanup failed:', error);
    exitCode = 1;
  } finally {
    await app.close();
    process.exit(exitCode);
  }
}

bootstrap();
