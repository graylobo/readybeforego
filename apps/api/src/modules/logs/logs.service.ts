import { Inject, Injectable } from '@nestjs/common';
import { LogsRepository } from './logs.repository';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface CreateLogDto {
  userId: string;
  type: 'LOGIN' | 'POST_CREATE' | 'COMMENT_CREATE' | 'LIKE' | 'UPDATE_PROFILE' | 'DELETE_POST';
  action: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class LogsService {
  constructor(
    private readonly logsRepo: LogsRepository,
    @InjectQueue('logs') private logsQueue: Queue,
  ) {}

  async create(dto: CreateLogDto) {
    try {
      // 이제 직접 DB에 쓰는 대신 백그라운드 큐에 작업을 위임합니다.
      await this.logsQueue.add('create-log', dto, {
        attempts: 3,         // 실패 시 3번 재시도
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true, // 메모리 낭비 방지
      });
      // 큐에 등록되었으므로 임시로 빈 객체 반환 (또는 Promise를 분리할 수도 있음)
      return { status: 'queued' };
    } catch (error) {
      console.error('Failed to queue log job:', error);
    }
  }

  async findByUser(userId: string, limit: number = 20) {
    return this.logsRepo.findLogsByUser(userId, limit);
  }

  async findAll(page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    return this.logsRepo.findAllLogs(offset, limit);
  }
}
