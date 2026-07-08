import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { createKeyv } from '@keyv/redis';
import Redis from 'ioredis';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BoardsModule } from './modules/boards/boards.module';
import { CommentsModule } from './modules/comments/comments.module';
import { EmoticonsModule } from './modules/emoticons/emoticons.module';
import { LogsModule } from './modules/logs/logs.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PointsModule } from './modules/points/points.module';
import { PostsModule } from './modules/posts/posts.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        return redisUrl ? { stores: [createKeyv(redisUrl)] } : {}; 
      },
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PointsModule,
    BoardsModule,
    PostsModule,
    CommentsModule,
    LogsModule,
    NotificationsModule,
    AdminModule,
    MessagesModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    UploadsModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const throttlers = [{ ttl: 60000, limit: 120 }];
        const redisUrl = configService.get<string>('REDIS_URL');
        // 다중 인스턴스(스케일아웃) 환경에서 rate limit 카운트를 공유하기 위해
        // Redis 저장소를 사용한다. REDIS_URL이 없으면 인메모리(단일 인스턴스)로 폴백.
        if (!redisUrl) {
          return { throttlers };
        }
        const options: Record<string, unknown> = { keepAlive: 10000 };
        if (redisUrl.startsWith('rediss://')) {
          options.tls = { rejectUnauthorized: false };
        }
        return {
          throttlers,
          storage: new ThrottlerStorageRedisService(new Redis(redisUrl, options)),
        };
      },
    }),
    EmoticonsModule,
    SettingsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
