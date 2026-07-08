import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, gt } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { notifications } from '../../database/schema';

export type Transaction = any;

@Injectable()
export class NotificationsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async findDuplicateNotification(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.notifications.findFirst({
          where: and(
              eq(notifications.userId, data.userId),
              eq(notifications.actorId, data.actorId),
              eq(notifications.type, data.type),
              eq(notifications.targetId, data.targetId)
          ),
      });
  }

  async insertNotification(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.insert(notifications).values(data).returning();
  }

  async findAllNotifications(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.notifications.findMany({
          where: eq(notifications.userId, userId),
          orderBy: [desc(notifications.createdAt)],
          limit: 50,
      });
  }

  async findNotificationsSince(userId: string, sinceDate: Date, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.notifications.findMany({
          where: and(
              eq(notifications.userId, userId),
              gt(notifications.createdAt, sinceDate)
          ),
          orderBy: [desc(notifications.createdAt)],
          limit: 100,
      });
  }

  async countUnread(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const result = await db.query.notifications.findMany({
          where: and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, false)
          ),
      });
      return result.length;
  }

  async markAsRead(id: string, userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
          .returning();
  }

  async markAllAsRead(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
          .returning();
  }

  async deleteNotification(id: string, userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.delete(notifications)
          .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
          .returning();
  }

  async deleteAllNotifications(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.delete(notifications)
          .where(eq(notifications.userId, userId))
          .returning();
  }
}
