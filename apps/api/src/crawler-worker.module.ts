import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { CrawlerWorkerModule } from './modules/crawler/worker/crawler-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url:
            configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    CrawlerWorkerModule,
  ],
})
export class CrawlerWorkerAppModule {}
