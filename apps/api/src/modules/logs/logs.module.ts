import { Global, Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { LogsListener } from './logs.listener';
import { LogsRepository } from './logs.repository';
import { BullModule } from '@nestjs/bullmq';
import { LogsProcessor } from './logs.processor';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'logs',
    }),
  ],
  providers: [LogsService, LogsListener, LogsRepository, LogsProcessor],
  controllers: [LogsController],
  exports: [LogsService, LogsRepository],
})
export class LogsModule {}
