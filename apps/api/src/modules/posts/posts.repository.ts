import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';

export type Transaction = any;

@Injectable()
export class PostsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async findPublicBoards(tx?: Transaction) {
    const db = tx ?? this.db;
    return db.select({ id: schema.boards.id })
      .from(schema.boards)
      .where(eq(schema.boards.isPrivate, false));
  }

  async searchPosts(
    whereClause: SQL | undefined,
    offset: number,
    limit: number,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    return db.select({
      post: schema.posts,
      user: {
          id: schema.users.id,
          name: schema.users.name,
          picture: schema.users.picture,
          role: schema.users.role,
      },
      board: {
          slug: schema.boards.slug,
          name: schema.boards.name,
      }
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .leftJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
    .where(whereClause)
    .orderBy(desc(schema.posts.isNotice), desc(schema.posts.isPinned), desc(schema.posts.createdAt))
    .limit(limit)
    .offset(offset);
  }

  async countPosts(whereClause: SQL | undefined, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
      .where(whereClause);
    return result.count;
  }

  async getReactionCountsForPosts(postIds: string[], tx?: Transaction) {
    if (postIds.length === 0) return [];
    const db = tx ?? this.db;
    return db
      .select({
          postId: schema.postReactions.postId,
          type: schema.postReactions.type,
          count: sql<number>`count(*)::int`,
      })
      .from(schema.postReactions)
      .where(inArray(schema.postReactions.postId, postIds))
      .groupBy(schema.postReactions.postId, schema.postReactions.type);
  }

  async getUserReactionsForPosts(postIds: string[], userId: string, tx?: Transaction) {
    if (postIds.length === 0) return [];
    const db = tx ?? this.db;
    return db
      .select({
          postId: schema.postReactions.postId,
          type: schema.postReactions.type,
      })
      .from(schema.postReactions)
      .where(
          and(
              inArray(schema.postReactions.postId, postIds),
              eq(schema.postReactions.userId, userId)
          )
      );
  }

  async findByIdWithDetails(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.posts.findFirst({
      where: and(eq(schema.posts.id, id), isNull(schema.posts.deletedAt)),
      with: {
          board: true,
          user: { columns: { id: true, name: true, picture: true, role: true } },
      }
    });
  }

  async findById(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.posts.findFirst({
        where: and(eq(schema.posts.id, id), isNull(schema.posts.deletedAt)),
      });
  }

  async incrementViewCount(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    await db.update(schema.posts)
      .set({ viewCount: sql`${schema.posts.viewCount} + 1` })
      .where(eq(schema.posts.id, id));
  }

  async getReactionCountsForPost(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db
      .select({
          type: schema.postReactions.type,
          count: sql<number>`count(*)::int`,
      })
      .from(schema.postReactions)
      .where(eq(schema.postReactions.postId, id))
      .groupBy(schema.postReactions.type);
  }

  async findUserReaction(
    postId: string, 
    userId?: string, 
    ipAddress?: string, 
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    let whereClause;
    
    if (userId) {
        whereClause = and(eq(schema.postReactions.postId, postId), eq(schema.postReactions.userId, userId));
    } else if (ipAddress) {
        whereClause = and(
          eq(schema.postReactions.postId, postId), 
          eq(schema.postReactions.ipAddress, ipAddress as string),
          isNull(schema.postReactions.userId)
        );
    } else {
        return null; // Not found
    }

    return db.query.postReactions.findFirst({
        where: whereClause
    });
  }

  async findUserScrap(postId: string, userId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.postScraps.findFirst({
        where: and(
            eq(schema.postScraps.postId, postId),
            eq(schema.postScraps.userId, userId)
        )
    });
  }

  async createPost(data: any, tx?: Transaction) {
    const db = tx ?? this.db;
    const [newPost] = await db.insert(schema.posts)
      .values(data)
      .returning();
    return newPost;
  }

  async updatePost(id: string, updates: any, tx?: Transaction) {
    const db = tx ?? this.db;
    const [updated] = await db.update(schema.posts)
      .set(updates)
      .where(eq(schema.posts.id, id))
      .returning();
    return updated;
  }

  async softDeletePost(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    await db.update(schema.posts)
      .set({ deletedAt: new Date() })
      .where(eq(schema.posts.id, id));
  }

  async softDeleteCommentsByPost(postId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    await db.update(schema.comments)
      .set({ deletedAt: new Date() })
      .where(and(
          eq(schema.comments.targetId, postId),
          eq(schema.comments.targetType, 'post'),
          isNull(schema.comments.deletedAt)
      ));
  }

  async findPostPassword(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.posts.findFirst({
        where: and(eq(schema.posts.id, id), isNull(schema.posts.deletedAt)),
        columns: { guestPassword: true },
    });
  }

  async deleteReaction(reactionId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.delete(schema.postReactions).where(eq(schema.postReactions.id, reactionId));
  }

  async updateReaction(reactionId: string, type: 'like' | 'dislike', tx?: Transaction) {
      const db = tx ?? this.db;
      await db.update(schema.postReactions)
          .set({ type })
          .where(eq(schema.postReactions.id, reactionId));
  }

  async createReaction(data: any, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.insert(schema.postReactions).values(data);
  }

  async deleteScrap(scrapId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.delete(schema.postScraps).where(eq(schema.postScraps.id, scrapId));
  }

  async createScrap(postId: string, userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      await db.insert(schema.postScraps).values({
          postId,
          userId,
      });
  }

  async findScrappedPosts(userId: string, offset: number, limit: number, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.postScraps.findMany({
          where: eq(schema.postScraps.userId, userId),
          limit,
          offset,
          orderBy: [desc(schema.postScraps.createdAt)],
          with: {
              post: {
                  with: {
                      user: {
                          columns: {
                              id: true,
                              name: true,
                              picture: true,
                              role: true,
                          }
                      },
                      board: {
                          columns: {
                              slug: true,
                              name: true,
                          }
                      }
                  }
              }
          }
      });
  }

  async countScrappedPosts(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
          .from(schema.postScraps)
          .where(eq(schema.postScraps.userId, userId));
      return result.count;
  }

  async findUserById(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(schema.users.id, userId),
      });
  }
}
