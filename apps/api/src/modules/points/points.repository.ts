import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, count } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { pointHistory, pointPolicies, userPoints } from '../../database/schema';

export type Transaction = any;

@Injectable()
export class PointsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async findUserPoints(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.userPoints.findFirst({
          where: eq(userPoints.userId, userId),
      });
  }

  async insertUserPoints(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.insert(userPoints).values(data).returning();
  }

  async updateUserPoints(userId: string, data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(userPoints)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(userPoints.userId, userId))
          .returning();
  }

  async findPointHistory(userId: string, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.pointHistory.findMany({
          where: eq(pointHistory.userId, userId),
          orderBy: (history, { desc }) => [desc(history.createdAt)],
          limit
      });
  }

  async findPointPolicy(actionType: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.pointPolicies.findFirst({
          where: and(eq(pointPolicies.actionType, actionType), eq(pointPolicies.isActive, true)),
      });
  }

  async insertPointHistory(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.insert(pointHistory).values(data);
  }

  async countPolicies(tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ value: count() }).from(pointPolicies);
      return result.value;
  }

  async insertPolicies(data: any[], tx?: Transaction) {
      const db = tx ?? this.db;
      await db.insert(pointPolicies).values(data);
  }
}
