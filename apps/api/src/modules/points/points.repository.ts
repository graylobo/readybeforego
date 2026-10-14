import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, count, gte, sql } from 'drizzle-orm';
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

  /**
   * 포인트를 더하거나 뺀다 (음수면 빼기, 0 아래로는 내려가지 않음). 레벨도 함께 다시 계산한다.
   * DB에서 한 번에 계산해, 동시에 여러 요청이 와도 서로 덮어써 값이 사라지지 않는다
   */
  async applyPointsDelta(userId: string, accumulatedDelta: number, availableDelta: number, tx?: Transaction) {
      const db = tx ?? this.db;
      const nextAccumulated = sql`greatest(${userPoints.accumulatedPoints} + ${accumulatedDelta}, 0)`;
      const initialAccumulated = Math.max(0, accumulatedDelta);
      const [row] = await db.insert(userPoints)
          .values({
              userId,
              accumulatedPoints: initialAccumulated,
              availablePoints: Math.max(0, availableDelta),
              level: Math.floor(Math.sqrt(initialAccumulated / 100)) + 1,
          })
          .onConflictDoUpdate({
              target: userPoints.userId,
              set: {
                  accumulatedPoints: nextAccumulated,
                  availablePoints: sql`greatest(${userPoints.availablePoints} + ${availableDelta}, 0)`,
                  // calculateLevel과 같은 식: floor(sqrt(누적 / 100)) + 1
                  level: sql`floor(sqrt(${nextAccumulated} / 100.0))::int + 1`,
                  updatedAt: new Date(),
              },
          })
          .returning();
      return row;
  }

  /** 사용 가능 포인트가 충분할 때만 뺀다. 확인과 빼기를 한 번에 해 동시에 두 번 써도 잔액 이상 쓰지 못한다 */
  async deductAvailablePoints(userId: string, amount: number, tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const rows = await db.update(userPoints)
          .set({ availablePoints: sql`${userPoints.availablePoints} - ${amount}`, updatedAt: new Date() })
          .where(and(eq(userPoints.userId, userId), gte(userPoints.availablePoints, amount)))
          .returning({ id: userPoints.id });
      return rows.length > 0;
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

  /** 특정 글/댓글로 생긴 포인트 기록 (지급·회수 여부 확인용) */
  async findHistoryByRelated(userId: string, relatedId: string, relatedType: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.select({ points: pointHistory.points })
          .from(pointHistory)
          .where(and(
              eq(pointHistory.userId, userId),
              eq(pointHistory.relatedId, relatedId),
              eq(pointHistory.relatedType, relatedType),
          ));
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
