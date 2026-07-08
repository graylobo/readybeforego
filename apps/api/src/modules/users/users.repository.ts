import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, or, and, isNull, sql, ilike, SQL } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { users } from '../../database/schema';

export type Transaction = any;

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async findAll(search?: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findMany({
          where: search ? or(
              ilike(users.name, `%${search}%`),
              ilike(users.email, `%${search}%`)
          ) : undefined,
          orderBy: (users, { desc }) => [desc(users.createdAt)],
      });
  }

  async findBySocialOrEmail(data: Partial<typeof users.$inferInsert>, tx?: Transaction) {
      const db = tx ?? this.db;
      const conditions: SQL[] = [];
      if (data.googleId) conditions.push(eq(users.googleId, data.googleId));
      if (data.kakaoId) conditions.push(eq(users.kakaoId, data.kakaoId));
      if (data.naverId) conditions.push(eq(users.naverId, data.naverId));
      if (data.email) conditions.push(eq(users.email, data.email));

      if (conditions.length > 0) {
          return db.query.users.findFirst({
              where: or(...conditions),
          });
      }
      return null;
  }

  async findByName(name: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(users.name, name),
      });
  }

  async updateUser(id: string, updateData: any, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updated] = await db.update(users)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning();
      return updated;
  }

  async createUser(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      const [created] = await db.insert(users)
          .values({
              ...data,
              role: 'user',
              isProfileSetup: false, 
          })
          .returning();
      return created;
  }

  async findById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(users.id, id),
          with: {
              userPoints: true,
          }
      });
  }

  async findPublicProfile(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(users.id, id),
          columns: {
              id: true,
              name: true,
              picture: true,
              role: true,
              createdAt: true,
          }
      });
  }

  async findUserPoints(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.userPoints.findFirst({
          where: eq(schema.userPoints.userId, id)
      });
  }

  async countUserPosts(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.posts)
          .where(and(eq(schema.posts.userId, id), isNull(schema.posts.deletedAt)));
      return result.count;
  }

  async countUserVisitDays(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db
          .select({ count: sql<number>`count(distinct date_trunc('day', created_at))::int` })
          .from(schema.userLogs)
          .where(and(eq(schema.userLogs.userId, id), eq(schema.userLogs.type, 'LOGIN')));
      return result.count;
  }

  async deleteUser(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [deleted] = await db.delete(users)
          .where(eq(users.id, id))
          .returning();
      return deleted;
  }
}
