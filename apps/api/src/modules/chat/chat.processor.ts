import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ChatRepository, NewChatMessageRow } from './chat.repository';
import { CHAT_PERSIST_QUEUE } from './chat.constants';
import { ChatMessage } from '@community/shared-types';
import { ChatSettingsService } from './chat-settings.service';

@Processor(CHAT_PERSIST_QUEUE)
export class ChatProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatProcessor.name);

  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly chatSettings: ChatSettingsService,
  ) {
    super();
  }

  async process(job: Job<ChatMessage>) {
    if (!(await this.chatSettings.isPersistEnabled())) {
      return;
    }
    const row: NewChatMessageRow = {
      id: job.data.id,
      roomSlug: job.data.roomSlug,
      authorType: job.data.authorType,
      userId: job.data.userId,
      guestId: job.data.guestId,
      nickname: job.data.nickname,
      content: job.data.content,
      replyToId: job.data.replyTo?.id ?? null,
      replyToNickname: job.data.replyTo?.nickname ?? null,
      replyToContent: job.data.replyTo?.content ?? null,
      createdAt: new Date(job.data.createdAt),
    };

    try {
      await this.chatRepo.insertMessage(row);
    } catch (error) {
      this.logger.error(`Failed to persist chat message ${job.data.id}`, error);
      throw error;
    }
  }
}
