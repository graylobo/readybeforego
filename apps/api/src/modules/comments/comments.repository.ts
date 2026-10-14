import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';

export type Transaction = any;

@Injectable()
export class CommentsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async findUserById(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(schema.users.id, userId),
          columns: { id: true, name: true, picture: true }
      });
  }

  /**
   * 댓글을 달거나 볼 게시글의 접근 정보 (삭제된 글이면 undefined).
   * 비공개 게시판 글이면 작성자/관리자만 댓글을 보고 달 수 있다
   */
  async findPostAccess(postId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.select({
          userId: schema.posts.userId,
          allowComments: schema.posts.allowComments,
          boardId: schema.posts.boardId,
          isPrivate: schema.boards.isPrivate,
          isReadOnly: schema.boards.isReadOnly,
          hiddenAt: schema.posts.hiddenAt,
      })
      .from(schema.posts)
      .innerJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
      .where(and(eq(schema.posts.id, postId), isNull(schema.posts.deletedAt)));
      return row;
  }

  async createComment(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      const [comment] = await db.insert(schema.comments).values(data).returning();
      return comment as typeof schema.comments.$inferSelect;
  }

  async updatePostCommentCount(postId: string, increment: number, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updatedPost] = await db.update(schema.posts)
          .set({ commentCount: sql`${schema.posts.commentCount} + ${increment}` })
          .where(eq(schema.posts.id, postId))
          .returning({ commentCount: schema.posts.commentCount });
      return updatedPost?.commentCount;
  }

  // 실제로 남아 있는(삭제 표시되지 않은) 댓글 기준으로 게시글의 댓글 수를 다시 계산 (답글까지 함께 지워진 경우용)
  async recountPostCommentCount(postId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updatedPost] = await db.update(schema.posts)
          .set({
              commentCount: sql`(
                  SELECT COUNT(*)::int FROM comments c
                  WHERE c.target_type = 'post' AND c.target_id = ${schema.posts.id}::text AND c.deleted_at IS NULL
              )`,
          })
          .where(eq(schema.posts.id, postId))
          .returning({ commentCount: schema.posts.commentCount });
      return updatedPost?.commentCount;
  }

  async findCommentsByTarget(targetType: 'post' | 'board' | string, targetId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.comments.findMany({
          where: and(
              eq(schema.comments.targetType, targetType),
              eq(schema.comments.targetId, targetId),
          ),
          // 비회원 댓글 비밀번호 해시는 목록 응답에 포함하지 않는다
          columns: { guestPassword: false },
          with: {
              user: { columns: { id: true, name: true, picture: true } },
          },
          orderBy: asc(schema.comments.createdAt),
      });
  }

  /**
   * 한 글에 달린 댓글 중 내가 반응한 것들 (댓글 목록 조회와 동시에 실행할 수 있도록 댓글 id 대신 글 기준으로 조회)
   */
  async findUserReactionsByTarget(targetType: string, targetId: string, userId?: string, ipAddress?: string, tx?: Transaction) {
      if (!userId && !ipAddress) return [];
      const db = tx ?? this.db;

      const userFilter = userId
        ? eq(schema.commentReactions.userId, userId)
        : and(isNull(schema.commentReactions.userId), eq(schema.commentReactions.ipAddress, ipAddress as string));

      return db.select({
          commentId: schema.commentReactions.commentId,
          type: schema.commentReactions.type,
      })
      .from(schema.commentReactions)
      .innerJoin(schema.comments, eq(schema.comments.id, schema.commentReactions.commentId))
      .where(and(
          eq(schema.comments.targetType, targetType),
          eq(schema.comments.targetId, targetId),
          userFilter,
      ));
  }

  async findById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.comments.findFirst({
          where: and(eq(schema.comments.id, id), isNull(schema.comments.deletedAt)),
      });
  }

  // 이미 삭제된(soft delete) 댓글도 포함 (Super Admin 완전 삭제용)
  async findByIdIncludingDeleted(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.comments.findFirst({
          where: eq(schema.comments.id, id),
      });
  }

  async updateComment(id: string, data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updated] = await db.update(schema.comments)
          .set(data)
          .where(eq(schema.comments.id, id))
          .returning();
      return updated;
  }

  // 이미 삭제된 댓글이면 false (동시에 두 번 삭제해도 댓글 수가 한 번만 줄도록)
  async softDeleteComment(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const rows = await db.update(schema.comments)
          .set({ deletedAt: new Date() })
          .where(and(eq(schema.comments.id, id), isNull(schema.comments.deletedAt)))
          .returning({ id: schema.comments.id });
      return rows.length > 0;
  }

  /**
   * 이 댓글과 그 아래 모든 답글 (완전 삭제 시 답글까지 함께 지워지므로 첨부 이미지와 받은 포인트도 같이 정리하기 위함)
   */
  async findThread(id: string, tx?: Transaction): Promise<{ id: string; userId: string | null; imageUrl: string | null; isDeleted: boolean }[]> {
      const db = tx ?? this.db;
      const result = await db.execute(sql`
          with recursive thread as (
              select id, user_id, image_url, deleted_at from comments where id = ${id}
              union all
              select c.id, c.user_id, c.image_url, c.deleted_at from comments c join thread t on c.parent_id = t.id
          )
          select id, user_id, image_url, deleted_at from thread
      `);
      return (result.rows as { id: string; user_id: string | null; image_url: string | null; deleted_at: Date | null }[]).map((row) => ({
          id: row.id,
          userId: row.user_id,
          imageUrl: row.image_url,
          isDeleted: !!row.deleted_at,
      }));
  }

  async hardDeleteComment(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.delete(schema.comments)
          .where(eq(schema.comments.id, id));
  }

  async findUserReaction(commentId: string, userId?: string, ipAddress?: string, tx?: Transaction) {
      const db = tx ?? this.db;

      const reactionFilter = userId 
        ? eq(schema.commentReactions.userId, userId)
        : and(isNull(schema.commentReactions.userId), eq(schema.commentReactions.ipAddress, ipAddress || ''));

      return db.query.commentReactions.findFirst({
          where: and(eq(schema.commentReactions.commentId, commentId), reactionFilter)
      });
  }

  /** 반응 삭제. 실제로 지웠는지 돌려준다 (동시에 두 번 지워도 수치는 한 번만 바뀌도록) */
  async deleteReaction(reactionId: string, tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const deleted = await db.delete(schema.commentReactions)
          .where(eq(schema.commentReactions.id, reactionId))
          .returning({ id: schema.commentReactions.id });
      return deleted.length > 0;
  }

  /** 반응 종류 변경. 아직 이전 종류일 때만 바꾸고, 실제로 바꿨는지 돌려준다 */
  async updateReaction(reactionId: string, fromType: 'like' | 'dislike', toType: 'like' | 'dislike', tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const updated = await db.update(schema.commentReactions)
          .set({ type: toType, updatedAt: new Date() })
          .where(and(eq(schema.commentReactions.id, reactionId), eq(schema.commentReactions.type, fromType)))
          .returning({ id: schema.commentReactions.id });
      return updated.length > 0;
  }

  /** 반응 추가. 같은 사람이 동시에 두 번 눌러도 고유 인덱스 때문에 하나만 들어가며, 실제로 추가됐는지 돌려준다 */
  async createReaction(data: any, tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const inserted = await db.insert(schema.commentReactions)
          .values(data)
          .onConflictDoNothing()
          .returning({ id: schema.commentReactions.id });
      return inserted.length > 0;
  }

  /** 댓글에 저장된 추천/비추천 수를 변화량만큼 갱신 */
  async applyReactionDelta(commentId: string, likeDelta: number, dislikeDelta: number, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.update(schema.comments)
          .set({
              likeCount: sql`greatest(${schema.comments.likeCount} + ${likeDelta}, 0)`,
              dislikeCount: sql`greatest(${schema.comments.dislikeCount} + ${dislikeDelta}, 0)`,
          })
          .where(eq(schema.comments.id, commentId))
          .returning({ likeCount: schema.comments.likeCount, dislikeCount: schema.comments.dislikeCount });
      return row;
  }

  async findCommentsByUserWithPostDetails(userId: string, offset: number, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.select({
            id: schema.comments.id,
            content: schema.comments.content,
            createdAt: schema.comments.createdAt,
            targetId: schema.comments.targetId,
            targetType: schema.comments.targetType,
            postTitle: schema.posts.title,
            boardSlug: schema.boards.slug,
          })
          .from(schema.comments)
          .leftJoin(schema.posts, sql`${schema.comments.targetId} = ${schema.posts.id}::text`)
          .leftJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
          .where(and(eq(schema.comments.userId, userId), isNull(schema.comments.deletedAt)))
          .orderBy(desc(schema.comments.createdAt))
          .limit(limit)
          .offset(offset);
  }

  async countCommentsByUser(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
          .from(schema.comments)
          .where(and(eq(schema.comments.userId, userId), isNull(schema.comments.deletedAt)));
      return result.count;
  }
}
