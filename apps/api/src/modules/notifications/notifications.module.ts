import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsRepository } from './notifications.repository';
import { forwardRef } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { CommentsModule } from '../comments/comments.module';

@Global()
@Module({
  imports: [
    forwardRef(() => PostsModule),
    forwardRef(() => CommentsModule),
  ],
  providers: [
    NotificationsService,
    NotificationsListener,
    NotificationsRepository,
    {
      provide: 'REDIS_PUBLISHER',
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const options: any = {
          keepAlive: 10000, // 10초마다 TCP Keep-Alive 패킷을 송출하여 Aiven 방화벽의 유휴 연결 차단 방지
        };
        // Aiven Cloud 등 SSL/TLS가 필수인 클라우드 Redis 환경 대응 (rediss 접두사 감지)
        if (url.startsWith('rediss://')) {
          options.tls = { rejectUnauthorized: false };
        }
        return new Redis(url, options);
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDIS_SUBSCRIBER',
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const options: any = {
          keepAlive: 10000,
        };
        if (url.startsWith('rediss://')) {
          options.tls = { rejectUnauthorized: false };
        }
        return new Redis(url, options);
      },
      inject: [ConfigService],
    },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsRepository, 'REDIS_PUBLISHER', 'REDIS_SUBSCRIBER'],
})
export class NotificationsModule {}
