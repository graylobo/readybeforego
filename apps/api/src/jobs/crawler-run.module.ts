import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../database/database.module';
import { CrawlerCoreModule } from '../modules/crawler/crawler-core.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    CrawlerCoreModule,
  ],
})
export class CrawlerRunJobModule {}
