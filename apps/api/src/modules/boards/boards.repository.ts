import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { boardManagers, boardRequests, boards, users } from '../../database/schema';

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

  /** 게시판의 (삭제되지 않은) 게시글 수 */
  async countLivePosts(boardId: string, tx?: Transaction): Promise<number> {
      const db = tx ?? this.db;
      const [row] = await db.select({ count: sql<number>`count(*)::int` })
          .from(schema.posts)
          .where(and(eq(schema.posts.boardId, boardId), isNull(schema.posts.deletedAt)));
      return row.count;
  }

  /**
   * 게시판 삭제. 게시글은 DB에서 함께 지워지지만(onDelete cascade) 댓글은 게시글과 직접 연결돼 있지 않아
   * 남으므로 같은 트랜잭션에서 먼저 지운다
   */
  async deleteBoard(id: string, tx?: Transaction) {
      const run = async (db: Transaction) => {
          await db.delete(schema.comments).where(and(
              eq(schema.comments.targetType, 'post'),
              // 댓글의 target_id는 text 컬럼이라 게시글 id(uuid)를 글자로 바꿔 비교한다
              sql`${schema.comments.targetId} in (select ${schema.posts.id}::text from ${schema.posts} where ${schema.posts.boardId} = ${id})`,
          ));
          await db.delete(boards).where(eq(boards.id, id));
      };
      return tx ? run(tx) : this.db.transaction(run);
  }

  // ---- 게시판 목록 페이지 ----

  /** 공개 게시판과 글 수, 매니저. 이름 검색 */
  async findDirectory(query: string | undefined, tx?: Transaction) {
      const db = tx ?? this.db;
      const q = query?.trim();
      const pattern = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
      return db.select({
          id: boards.id,
          slug: boards.slug,
          name: boards.name,
          description: boards.description,
          type: boards.type,
          isReadOnly: boards.isReadOnly,
          createdAt: boards.createdAt,
          // 하위 쿼리 안의 컬럼은 drizzle이 테이블 이름 없이 써서 겹치므로(id 등) 별칭을 붙여 직접 적는다
          postCount: sql<number>`(select count(*)::int from posts p where p.board_id = "boards"."id" and p.deleted_at is null)`,
          // 매니저가 관리자 표시를 끈 게시판은 이름을 내려주지 않는다
          managerName: sql<string | null>`case when "boards"."show_managers" then (select u.name from board_managers bm join users u on u.id = bm.user_id where bm.board_id = "boards"."id" and bm.role = 'manager' limit 1) end`,
      })
      .from(boards)
      .where(and(
          eq(boards.isActive, true),
          eq(boards.isPrivate, false),
          pattern ? or(ilike(boards.name, pattern), ilike(boards.slug, pattern)) : undefined,
      ))
      .orderBy(asc(boards.sortOrder), asc(boards.createdAt));
  }

  // ---- 게시판 관리자 ----

  async findManagers(boardId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.select({
          userId: boardManagers.userId,
          role: boardManagers.role,
          name: users.name,
          picture: users.picture,
      })
      .from(boardManagers)
      .innerJoin(users, eq(users.id, boardManagers.userId))
      .where(eq(boardManagers.boardId, boardId))
      .orderBy(asc(boardManagers.role), asc(boardManagers.createdAt));
  }

  async findManagerRole(boardId: string, userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.select({ role: boardManagers.role })
          .from(boardManagers)
          .where(and(eq(boardManagers.boardId, boardId), eq(boardManagers.userId, userId)))
          .limit(1);
      return row?.role ?? null;
  }

  async insertManager(data: { boardId: string; userId: string; role: 'manager' | 'sub_manager' }, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.insert(boardManagers).values(data);
  }

  async deleteManager(boardId: string, userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const rows = await db.delete(boardManagers)
          .where(and(eq(boardManagers.boardId, boardId), eq(boardManagers.userId, userId)))
          .returning({ id: boardManagers.id });
      return rows.length > 0;
  }

  async deleteManagersByRole(boardId: string, role: 'manager' | 'sub_manager', tx?: Transaction) {
      const db = tx ?? this.db;
      await db.delete(boardManagers).where(and(eq(boardManagers.boardId, boardId), eq(boardManagers.role, role)));
  }

  async findUserByName(name: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.name, name)).limit(1);
      return row;
  }

  // ---- 게시판 개설 신청 ----

  async countPendingRequests(requesterId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.select({ count: sql<number>`count(*)::int` })
          .from(boardRequests)
          .where(and(eq(boardRequests.requesterId, requesterId), eq(boardRequests.status, 'pending')));
      return row.count;
  }

  /** 대기 중인 신청이 이미 그 주소를 쓰고 있는지 */
  async isSlugRequested(slug: string, excludeRequestId?: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.select({ id: boardRequests.id })
          .from(boardRequests)
          .where(and(
              eq(boardRequests.slug, slug),
              eq(boardRequests.status, 'pending'),
              excludeRequestId ? sql`${boardRequests.id} <> ${excludeRequestId}` : undefined,
          ))
          .limit(1);
      return !!row;
  }

  async insertRequest(data: { requesterId: string; slug: string; name: string; description?: string; reason?: string }, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.insert(boardRequests).values(data).returning();
      return row;
  }

  async findRequestById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.boardRequests.findFirst({ where: eq(boardRequests.id, id) });
  }

  async findRequestsByRequester(requesterId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.boardRequests.findMany({
          where: eq(boardRequests.requesterId, requesterId),
          orderBy: [desc(boardRequests.createdAt)],
          limit: 20,
      });
  }

  async findRequests(status: string | undefined, offset: number, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      const where = status ? eq(boardRequests.status, status as any) : undefined;
      const [items, [{ count }]] = await Promise.all([
          db.query.boardRequests.findMany({
              where,
              orderBy: [desc(boardRequests.createdAt)],
              limit,
              offset,
              with: { requester: { columns: { id: true, name: true, email: true } } },
          }),
          db.select({ count: sql<number>`count(*)::int` }).from(boardRequests).where(where),
      ]);
      return { items, total: count };
  }

  /** 대기 중일 때만 처리 상태로 바꾼다 (두 관리자가 동시에 처리해도 한 번만) */
  async markRequestReviewed(
      id: string,
      data: { status: 'approved' | 'rejected'; rejectReason?: string | null; reviewedById: string; boardId?: string | null },
      tx?: Transaction,
  ) {
      const db = tx ?? this.db;
      const [row] = await db.update(boardRequests)
          .set({ ...data, reviewedAt: new Date() })
          .where(and(eq(boardRequests.id, id), eq(boardRequests.status, 'pending')))
          .returning();
      return row;
  }

  async findBoardsByIds(ids: string[], tx?: Transaction) {
      if (ids.length === 0) return [];
      const db = tx ?? this.db;
      return db.select().from(boards).where(inArray(boards.id, ids));
  }
}
