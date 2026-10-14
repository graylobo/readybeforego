import { Injectable, Logger, Inject } from '@nestjs/common';
import type { StorageProvider } from '../interfaces/storage-provider.interface';

/**
 * 게시글에 사용되지 않은 temp 업로드 파일 정리
 *
 * 실행: 배치 작업(src/jobs/uploads-temp-cleanup.ts)을 외부 스케줄러(PM2 cron 등)로 매일 실행한다.
 * 서버리스 환경(Cloud Run 등)에서는 인프로세스 크론이 보장되지 않으므로 사용하지 않는다.
 */
@Injectable()
export class UploadsCleanupService {
  private readonly logger = new Logger(UploadsCleanupService.name);

  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly storageProvider: StorageProvider,
  ) {}

  async handleCleanup() {
    this.logger.log('Starting cleanup of temp folder...');

    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await this.storageProvider.cleanupTempFiles(oneDayAgo);

      this.logger.log('Cleanup process completed.');
    } catch (e) {
      this.logger.error('Cleanup process failed:', e);
      throw e;
    }
  }
}
