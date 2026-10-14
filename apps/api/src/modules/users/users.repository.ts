import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, or, and, isNull, sql, ilike, inArray, SQL } from 'drizzle-orm';
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

  async existsByNameIgnoreCase(name: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.name}) = lower(${name})`)
          .limit(1);
      return !!row;
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

  /**
   * 회원을 완전히 삭제한다. 회원이 남긴 반응·댓글은 DB가 함께 지우므로(onDelete cascade),
   * 게시글/댓글에 저장해 둔 추천 수와 댓글 수도 같은 트랜잭션에서 맞춰 준다
   */
  async deleteUser(id: string, tx?: Transaction) {
      const run = async (db: Transaction) => {
          await db.execute(sql`
              UPDATE posts p SET
                  like_count = greatest(p.like_count - r.likes, 0),
                  dislike_count = greatest(p.dislike_count - r.dislikes, 0)
              FROM (
                  SELECT post_id,
                         COUNT(*) FILTER (WHERE type = 'like')::int AS likes,
                         COUNT(*) FILTER (WHERE type = 'dislike')::int AS dislikes
                  FROM post_reactions WHERE user_id = ${id} GROUP BY post_id
              ) r
              WHERE p.id = r.post_id`);
          await db.execute(sql`
              UPDATE comments c SET
                  like_count = greatest(c.like_count - r.likes, 0),
                  dislike_count = greatest(c.dislike_count - r.dislikes, 0)
              FROM (
                  SELECT comment_id,
                         COUNT(*) FILTER (WHERE type = 'like')::int AS likes,
                         COUNT(*) FILTER (WHERE type = 'dislike')::int AS dislikes
                  FROM comment_reactions WHERE user_id = ${id} GROUP BY comment_id
              ) r
              WHERE c.id = r.comment_id`);

          // 회원의 댓글(과 그 답글)이 지워질 게시글 목록. 삭제 후 댓글 수를 다시 센다
          const commentedPosts = await db
              .selectDistinct({ postId: schema.comments.targetId })
              .from(schema.comments)
              .where(and(eq(schema.comments.userId, id), eq(schema.comments.targetType, 'post')));

          const [deleted] = await db.delete(users)
              .where(eq(users.id, id))
              .returning();

          if (deleted && commentedPosts.length > 0) {
              await this.recountPostComments(commentedPosts.map((row: { postId: string }) => row.postId), db);
          }
          return deleted;
      };
      return tx ? run(tx) : this.db.transaction(run);
  }

  // 게시글의 댓글 수를 실제로 남아 있는(삭제 표시되지 않은) 댓글 기준으로 다시 계산
  async recountPostComments(postIds: string[], tx?: Transaction) {
      const db = tx ?? this.db;
      await db.update(schema.posts)
          .set({
              commentCount: sql`(
                  SELECT COUNT(*)::int FROM comments c
                  WHERE c.target_type = 'post' AND c.target_id = ${schema.posts.id}::text AND c.deleted_at IS NULL
              )`,
          })
          .where(inArray(schema.posts.id, postIds));
  }
}
