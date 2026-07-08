import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { StorageProvider } from '../interfaces/storage-provider.interface';

@Injectable()
export class UploadsCleanupService {
  private readonly logger = new Logger(UploadsCleanupService.name);

  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly storageProvider: StorageProvider,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleCleanup() {
    this.logger.log('Starting cleanup of temp folder...');

    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await this.storageProvider.cleanupTempFiles(oneDayAgo);

      this.logger.log('Cleanup process completed.');
    } catch (e) {
      this.logger.error('Cleanup process failed:', e);
    }
  }
}
