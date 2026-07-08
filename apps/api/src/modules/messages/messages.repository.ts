import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { messages, users } from '../../database/schema';

export type Transaction = any;

@Injectable()
export class MessagesRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async findUserById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(users.id, id),
          columns: { id: true, name: true }
      });
  }

  async findUserByName(name: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(users.name, name),
          columns: { id: true, name: true }
      });
  }

  async insertMessage(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.insert(messages).values(data).returning();
  }

  async findReceivedMessages(userId: string, offset: number, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.select({
          message: messages,
          sender: {
              id: users.id,
              name: users.name,
              picture: users.picture,
          }
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(and(
          eq(messages.receiverId, userId),
          eq(messages.deletedByReceiver, false)
      ))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countReceivedMessages(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(
              eq(messages.receiverId, userId),
              eq(messages.deletedByReceiver, false)
          ));
      return result.count;
  }

  async findSentMessages(userId: string, offset: number, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.select({
          message: messages,
          receiver: {
              id: users.id,
              name: users.name,
              picture: users.picture,
          }
      })
      .from(messages)
      .leftJoin(users, eq(messages.receiverId, users.id))
      .where(and(
          eq(messages.senderId, userId),
          eq(messages.deletedBySender, false)
      ))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countSentMessages(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(
              eq(messages.senderId, userId),
              eq(messages.deletedBySender, false)
          ));
      return result.count;
  }

  async findMessageById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.messages.findFirst({
          where: eq(messages.id, id),
          with: {
              sender: { columns: { id: true, name: true, picture: true } },
              receiver: { columns: { id: true, name: true, picture: true } },
          }
      });
  }

  async markMessageAsRead(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(messages)
          .set({ isRead: true, readAt: new Date() })
          .where(eq(messages.id, id));
  }

  async markNotificationAsRead(userId: string, targetId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(schema.notifications)
          .set({ isRead: true })
          .where(and(
              eq(schema.notifications.userId, userId),
              eq(schema.notifications.targetId, targetId),
              eq(schema.notifications.targetType, 'MESSAGE')
          ));
  }

  async markMessageDeletedBySender(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(messages)
          .set({ deletedBySender: true })
          .where(eq(messages.id, id));
  }

  async markMessageDeletedByReceiver(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(messages)
          .set({ deletedByReceiver: true })
          .where(eq(messages.id, id));
  }

  async countUnreadMessages(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(
              eq(messages.receiverId, userId),
              eq(messages.isRead, false),
              eq(messages.deletedByReceiver, false)
          ));
      return result.count;
  }
}
