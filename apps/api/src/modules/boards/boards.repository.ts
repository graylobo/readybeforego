import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { boards } from '../../database/schema';

export type Transaction = any;

@Injectable()
export class BoardsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async findBySlug(slug: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.boards.findFirst({
          where: eq(boards.slug, slug),
      });
  }

  async findById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.boards.findFirst({
          where: eq(boards.id, id),
      });
  }

  async insertBoard(boardData: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.insert(boards).values(boardData).returning();
  }

  async findAllActive(tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.boards.findMany({
          where: eq(boards.isActive, true),
          orderBy: (boards, { asc }) => [asc(boards.sortOrder)],
      });
  }

  async findAll(tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.boards.findMany({
          orderBy: (boards, { asc }) => [asc(boards.sortOrder)],
      });
  }

  async updateBoard(id: string, dto: any, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.update(boards)
          .set({
              ...dto,
              updatedAt: new Date(),
          })
          .where(eq(boards.id, id))
          .returning();
  }

  async deleteBoard(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.delete(boards).where(eq(boards.id, id));
  }
}
