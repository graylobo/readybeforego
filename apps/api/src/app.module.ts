import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { SplitThrottlerStorage } from './common/guards/split-throttler.storage';
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
import { ScamsModule } from './modules/scams/scams.module';
import { GuidesModule } from './modules/guides/guides.module';
import { CountriesModule } from './modules/countries/countries.module';
import { ChatModule } from './modules/chat';
import { CrawlerModule } from './modules/crawler/crawler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
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
      serveStaticOptions: {
        // 로컬 저장소(STORAGE_TYPE=local)의 업로드 이미지는 웹(다른 주소)에서 불러온다.
        // helmet 기본값(same-origin)이면 브라우저가 이미지를 막으므로 이 경로만 다른 주소에서 쓰도록 허용
        setHeaders: (res) => {
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        },
      },
    }),
    EventEmitterModule.forRoot(),
    UploadsModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const throttlers = [{ ttl: 60000, limit: 120 }];
        const redisUrl = configService.get<string>('REDIS_URL');
        // 다중 인스턴스(스케일아웃) 환경에서 쓰기 요청의 rate limit 카운트를 공유하기 위해
        // Redis 저장소를 사용한다. 조회 요청은 속도를 위해 인메모리로 센다 (SplitThrottlerStorage).
        // REDIS_URL이 없으면 전부 인메모리(단일 인스턴스)로 폴백.
        if (!redisUrl) {
          return { throttlers };
        }
        const options: Record<string, unknown> = { keepAlive: 10000 };
        if (redisUrl.startsWith('rediss://')) {
          options.tls = { rejectUnauthorized: false };
        }
        return {
          throttlers,
          storage: new SplitThrottlerStorage(
            new ThrottlerStorageRedisService(new Redis(redisUrl, options)),
          ),
        };
      },
    }),
    EmoticonsModule,
    SettingsModule,
    ReportsModule,
    ScamsModule,
    GuidesModule,
    CountriesModule,
    ChatModule,
    CrawlerModule,
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
