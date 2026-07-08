import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { userLogs } from '../../database/schema';

export type Transaction = any;

@Injectable()
export class LogsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async insertLog(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.insert(userLogs).values(data).returning();
  }

  async findLogsByUser(userId: string, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.userLogs.findMany({
          where: eq(userLogs.userId, userId),
          orderBy: [desc(userLogs.createdAt)],
          limit,
      });
  }

  async findAllLogs(offset: number, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      
      const [items, totalRes] = await Promise.all([
          db.query.userLogs.findMany({
              orderBy: [desc(userLogs.createdAt)],
              limit,
              offset,
              with: {
                  user: {
                      columns: {
                          id: true,
                          name: true,
                          email: true,
                          picture: true,
                      }
                  }
              }
          }),
          db.select({ count: sql<number>`count(*)` }).from(userLogs)
      ]);

      return { items, total: Number(totalRes[0].count) };
  }
}
