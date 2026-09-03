import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { chatMessages } from '../../database/schema';

const MESSAGE_COLUMNS = {
  id: chatMessages.id,
  roomSlug: chatMessages.roomSlug,
  authorType: chatMessages.authorType,
  userId: chatMessages.userId,
  guestId: chatMessages.guestId,
  nickname: chatMessages.nickname,
  content: chatMessages.content,
  replyToId: chatMessages.replyToId,
  replyToNickname: chatMessages.replyToNickname,
  replyToContent: chatMessages.replyToContent,
  createdAt: chatMessages.createdAt,
} as const;

export type NewChatMessageRow = typeof chatMessages.$inferInsert;

@Injectable()
export class ChatRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async insertMessage(row: NewChatMessageRow) {
    const [created] = await this.db.insert(chatMessages).values(row).returning();
    return created;
  }

  async findById(id: string, roomSlug?: string) {
    const rows = await this.db
      .select(MESSAGE_COLUMNS)
      .from(chatMessages)
      .where(roomSlug ? and(eq(chatMessages.id, id), eq(chatMessages.roomSlug, roomSlug)) : eq(chatMessages.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findRecent(roomSlug: string, limit: number) {
    return this.db
      .select(MESSAGE_COLUMNS)
      .from(chatMessages)
      .where(eq(chatMessages.roomSlug, roomSlug))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async deleteByRoom(roomSlug: string) {
    const deleted = await this.db
      .delete(chatMessages)
      .where(eq(chatMessages.roomSlug, roomSlug))
      .returning({ id: chatMessages.id });
    return deleted.length;
  }
}
