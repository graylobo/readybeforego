import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LogsRepository } from './logs.repository';
import { CreateLogDto } from './logs.service';

@Processor('logs')
export class LogsProcessor extends WorkerHost {
  constructor(private readonly logsRepo: LogsRepository) {
    super();
  }

  async process(job: Job<CreateLogDto>) {
    try {
      await this.logsRepo.insertLog({
        userId: job.data.userId,
        type: job.data.type,
        action: job.data.action,
        targetId: job.data.targetId,
        targetType: job.data.targetType,
        ipAddress: job.data.ipAddress,
        userAgent: job.data.userAgent,
      });
    } catch (error) {
      console.error(`Failed to process log job ${job.id}:`, error);
      throw error;
    }
  }
}
