import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
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

  async getPostSettings(postId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.posts.findFirst({
          where: eq(schema.posts.id, postId),
          columns: { id: true, allowComments: true, receiveCommentNotification: true }
      });
  }

  async createComment(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      const [comment] = await db.insert(schema.comments).values(data).returning();
      return comment;
  }

  async updatePostCommentCount(postId: string, increment: number, tx?: Transaction) {
      const db = tx ?? this.db;
      const [updatedPost] = await db.update(schema.posts)
          .set({ commentCount: sql`${schema.posts.commentCount} + ${increment}` })
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
          with: {
              user: { columns: { id: true, name: true, email: true, picture: true } },
          },
          orderBy: asc(schema.comments.createdAt),
      });
  }

  async findCommentReactions(commentIds: string[], userId?: string, ipAddress?: string, tx?: Transaction) {
      if (commentIds.length === 0) return [];
      const db = tx ?? this.db;
      
      const userFilter = userId 
        ? eq(schema.commentReactions.userId, userId)
        : and(isNull(schema.commentReactions.userId), eq(schema.commentReactions.ipAddress, ipAddress || ''));

      return db.select({
          commentId: schema.commentReactions.commentId,
          type: schema.commentReactions.type,
      })
      .from(schema.commentReactions)
      .where(
        and(
          userFilter,
          inArray(schema.commentReactions.commentId, commentIds),
        ),
      );
  }

  async countCommentReactionsByTarget(targetType: string, targetId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.select({
          commentId: schema.commentReactions.commentId,
          upvoteCount: sql<number>`COUNT(CASE WHEN ${schema.commentReactions.type} = 'like' THEN 1 END)::int`,
          downvoteCount: sql<number>`COUNT(CASE WHEN ${schema.commentReactions.type} = 'dislike' THEN 1 END)::int`,
      })
      .from(schema.commentReactions)
      .innerJoin(schema.comments, eq(schema.comments.id, schema.commentReactions.commentId))
      .where(and(
          eq(schema.comments.targetType, targetType),
          eq(schema.comments.targetId, targetId)
      ))
      .groupBy(schema.commentReactions.commentId);
  }

  async countCommentReactions(commentIds: string[], tx?: Transaction) {
      if (commentIds.length === 0) return [];
      const db = tx ?? this.db;
      return db.select({
          commentId: schema.commentReactions.commentId,
          upvoteCount: sql<number>`COUNT(CASE WHEN ${schema.commentReactions.type} = 'like' THEN 1 END)::int`,
          downvoteCount: sql<number>`COUNT(CASE WHEN ${schema.commentReactions.type} = 'dislike' THEN 1 END)::int`,
      })
      .from(schema.commentReactions)
      .where(inArray(schema.commentReactions.commentId, commentIds))
      .groupBy(schema.commentReactions.commentId);
  }

  async findById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.comments.findFirst({
          where: and(eq(schema.comments.id, id), isNull(schema.comments.deletedAt)),
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

  async softDeleteComment(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.update(schema.comments)
          .set({ deletedAt: new Date() })
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

  async deleteReaction(reactionId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.delete(schema.commentReactions).where(eq(schema.commentReactions.id, reactionId));
  }

  async updateReaction(reactionId: string, type: 'like' | 'dislike', tx?: Transaction) {
      const db = tx ?? this.db;
      await db.update(schema.commentReactions)
          .set({ type, updatedAt: new Date() })
          .where(eq(schema.commentReactions.id, reactionId));
  }

  async createReaction(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.insert(schema.commentReactions).values(data);
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
