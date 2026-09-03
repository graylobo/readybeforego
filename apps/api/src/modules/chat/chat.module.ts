import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../../database/database.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatProcessor } from './chat.processor';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { ChatSettingsRepository } from './chat-settings.repository';
import { ChatSettingsService } from './chat-settings.service';
import { CHAT_PERSIST_QUEUE } from './chat.constants';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    RedisModule,
    DatabaseModule,
    BullModule.registerQueue({
      name: CHAT_PERSIST_QUEUE,
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatSettingsRepository,
    ChatSettingsService,
    ChatService,
    ChatGateway,
    ChatRepository,
    ChatProcessor,
  ],
  exports: [ChatService, ChatSettingsService],
})
export class ChatModule {}
