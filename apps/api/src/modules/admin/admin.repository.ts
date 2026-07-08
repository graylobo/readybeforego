import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { count, eq, sql, desc, and, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';

export type Transaction = any;

@Injectable()
export class AdminRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async countTotalUsers(tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: count() }).from(schema.users);
      return result.count;
  }

  async countTodayUsers(today: Date, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db
          .select({ count: count() })
          .from(schema.users)
          .where(sql`${schema.users.createdAt} >= ${today}`);
      return result.count;
  }

  async countTotalBoards(tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: count() }).from(schema.boards);
      return result.count;
  }

  async countTotalPosts(tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db
          .select({ count: count() })
          .from(schema.posts)
          .where(sql`${schema.posts.deletedAt} IS NULL`);
      return result.count;
  }

  async countTodayPosts(today: Date, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db
          .select({ count: count() })
          .from(schema.posts)
          .where(and(
              sql`${schema.posts.createdAt} >= ${today}`,
              sql`${schema.posts.deletedAt} IS NULL`
          ));
      return result.count;
  }

  async countTotalComments(tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db
          .select({ count: count() })
          .from(schema.comments)
          .where(sql`${schema.comments.deletedAt} IS NULL`);
      return result.count;
  }

  async countTodayComments(today: Date, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db
          .select({ count: count() })
          .from(schema.comments)
          .where(and(
              sql`${schema.comments.createdAt} >= ${today}`,
              sql`${schema.comments.deletedAt} IS NULL`
          ));
      return result.count;
  }

  async getTopBoards(limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.select({
          id: schema.boards.id,
          name: schema.boards.name,
          slug: schema.boards.slug,
          postCount: count(schema.posts.id),
      })
      .from(schema.boards)
      .leftJoin(schema.posts, and(eq(schema.posts.boardId, schema.boards.id), isNull(schema.posts.deletedAt)))
      .groupBy(schema.boards.id)
      .orderBy(desc(count(schema.posts.id)))
      .limit(limit);
  }

  async getRecentModerationLogs(limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.userModerationLogs.findMany({
          limit,
          orderBy: [desc(schema.userModerationLogs.createdAt)],
          with: {
              user: { columns: { name: true } },
              admin: { columns: { name: true } },
          }
      });
  }

  async findUserById(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  }

  async incrementUserWarning(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updatedUser] = await db.update(schema.users)
          .set({ 
              warningCount: sql`${schema.users.warningCount} + 1`,
              updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId))
          .returning();
      return updatedUser;
  }

  async suspendUser(userId: string, bannedUntil: Date, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updatedUser] = await db.update(schema.users)
          .set({ 
              status: 'suspended',
              bannedUntil,
              updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId))
          .returning();
      return updatedUser;
  }

  async banUser(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updatedUser] = await db.update(schema.users)
          .set({ 
              status: 'banned',
              updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId))
          .returning();
      return updatedUser;
  }

  async reactivateUser(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updatedUser] = await db.update(schema.users)
          .set({ 
              status: 'active',
              bannedUntil: null,
              warningCount: 0,
              updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId))
          .returning();
      return updatedUser;
  }

  async insertModerationLog(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.insert(schema.userModerationLogs).values(data);
  }

  async findModerationLogsByUser(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.userModerationLogs.findMany({
          where: eq(schema.userModerationLogs.userId, userId),
          orderBy: [desc(schema.userModerationLogs.createdAt)],
          with: {
              admin: {
                  columns: {
                      id: true,
                      name: true,
                      picture: true,
                  }
              }
          }
      });
  }

  async findAllPointPolicies(tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.pointPolicies.findMany({
          orderBy: [desc(schema.pointPolicies.updatedAt)],
      });
  }

  async updatePointPolicy(id: string, data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updated] = await db.update(schema.pointPolicies)
          .set({
              ...data,
              updatedAt: new Date(),
          })
          .where(eq(schema.pointPolicies.id, id))
          .returning();
      return updated;
  }
}
