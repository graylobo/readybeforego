import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, asc, desc, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';

export type Transaction = any;

// 목록에 내려주는 게시글 컬럼. 본문(content)은 크기가 커서 피드형 화면 등 필요할 때만 포함한다.
const { content: _content, guestPassword: _guestPassword, ...POST_LIST_COLUMNS } = getTableColumns(schema.posts);

export const BEST_PROMOTION_LIKE_COUNT = 10;

@Injectable()
export class PostsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  /**
   * 게시글 목록 조회. 공개 게시판만 보여줄 때는 게시판 조인 조건으로 거른다 (공개 게시판 id를 따로 조회하지 않음)
   */
  async searchPosts(
    whereClause: SQL | undefined,
    offset: number,
    limit: number,
    includeContent = false,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    return db.select({
      post: includeContent ? { ...POST_LIST_COLUMNS, content: schema.posts.content } : POST_LIST_COLUMNS,
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
    // 조건에 게시판(공개 여부)이 들어갈 수 있으므로 게시판만 조인 (작성자 조인은 필요 없음)
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .leftJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
      .where(whereClause);
    return result.count;
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

  // 조회수 +1 후 바뀐 조회수 (없거나 삭제된 글이면 undefined)
  async incrementViewCount(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const [row] = await db.update(schema.posts)
      .set({ viewCount: sql`${schema.posts.viewCount} + 1` })
      .where(and(eq(schema.posts.id, id), isNull(schema.posts.deletedAt)))
      .returning({ viewCount: schema.posts.viewCount });
    return row?.viewCount as number | undefined;
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

  /** 게시글에 달린 (삭제되지 않은) 댓글의 첨부 이미지 주소 */
  async findCommentImagesByPost(postId: string, tx?: Transaction): Promise<string[]> {
    const db = tx ?? this.db;
    const rows = await db.select({ imageUrl: schema.comments.imageUrl })
      .from(schema.comments)
      .where(and(
        eq(schema.comments.targetId, postId),
        eq(schema.comments.targetType, 'post'),
        isNull(schema.comments.deletedAt),
        sql`${schema.comments.imageUrl} is not null`,
      ));
    return rows.map((row: { imageUrl: string | null }) => row.imageUrl as string);
  }

  /** 글쓴이가 자기 글에 단 (삭제되지 않은) 댓글 id. 글을 지우면 함께 지워지므로 그 댓글로 받은 포인트도 회수한다 */
  async findAuthorCommentIds(postId: string, authorId: string, tx?: Transaction): Promise<string[]> {
    const db = tx ?? this.db;
    const rows = await db.select({ id: schema.comments.id })
      .from(schema.comments)
      .where(and(
        eq(schema.comments.targetId, postId),
        eq(schema.comments.targetType, 'post'),
        eq(schema.comments.userId, authorId),
        isNull(schema.comments.deletedAt),
      ));
    return rows.map((row: { id: string }) => row.id);
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

  /** 반응 삭제. 실제로 지웠는지 돌려준다 (동시에 두 번 지워도 수치는 한 번만 바뀌도록) */
  async deleteReaction(reactionId: string, tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const deleted = await db.delete(schema.postReactions)
          .where(eq(schema.postReactions.id, reactionId))
          .returning({ id: schema.postReactions.id });
      return deleted.length > 0;
  }

  /** 반응 종류 변경. 아직 이전 종류일 때만 바꾸고, 실제로 바꿨는지 돌려준다 */
  async updateReaction(reactionId: string, fromType: 'like' | 'dislike', toType: 'like' | 'dislike', tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const updated = await db.update(schema.postReactions)
          .set({ type: toType })
          .where(and(eq(schema.postReactions.id, reactionId), eq(schema.postReactions.type, fromType)))
          .returning({ id: schema.postReactions.id });
      return updated.length > 0;
  }

  /**
   * 반응 추가. 같은 사람이 동시에 두 번 눌러도 고유 인덱스 때문에 하나만 들어가며, 실제로 추가됐는지 돌려준다
   */
  async createReaction(data: any, tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const inserted = await db.insert(schema.postReactions)
          .values(data)
          .onConflictDoNothing()
          .returning({ id: schema.postReactions.id });
      return inserted.length > 0;
  }

  /**
   * 게시글에 저장된 추천/비추천 수를 변화량만큼 갱신하고, 추천 수가 기준을 넘으면 베스트로 올린다 (한 번의 UPDATE)
   */
  async applyReactionDelta(postId: string, likeDelta: number, dislikeDelta: number, tx?: Transaction) {
      const db = tx ?? this.db;
      const nextLike = sql`greatest(${schema.posts.likeCount} + ${likeDelta}, 0)`;
      const [row] = await db.update(schema.posts)
          .set({
              likeCount: nextLike,
              dislikeCount: sql`greatest(${schema.posts.dislikeCount} + ${dislikeDelta}, 0)`,
              isBest: sql`${schema.posts.isBest} or ${nextLike} >= ${BEST_PROMOTION_LIKE_COUNT}`,
          })
          .where(eq(schema.posts.id, postId))
          .returning({
              likeCount: schema.posts.likeCount,
              dislikeCount: schema.posts.dislikeCount,
              isBest: schema.posts.isBest,
          });
      return row;
  }

  /**
   * 스크랩 토글: 있으면 지우고, 없으면 추가한다. 반환값은 토글 후 스크랩 여부
   */
  async toggleScrap(postId: string, userId: string, tx?: Transaction): Promise<boolean> {
      const db = tx ?? this.db;
      const deleted = await db.delete(schema.postScraps)
          .where(and(eq(schema.postScraps.postId, postId), eq(schema.postScraps.userId, userId)))
          .returning({ id: schema.postScraps.id });
      if (deleted.length > 0) return false;
      await db.insert(schema.postScraps).values({ postId, userId }).onConflictDoNothing();
      return true;
  }

  /**
   * 반응/스크랩 토글에 필요한 최소 정보 (알림 이벤트용 게시판 slug, 접근 확인용 비공개 여부 포함)
   */
  async findReactionTarget(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [row] = await db.select({
          id: schema.posts.id,
          userId: schema.posts.userId,
          title: schema.posts.title,
          isBest: schema.posts.isBest,
          boardSlug: schema.boards.slug,
          isPrivate: schema.boards.isPrivate,
          hiddenAt: schema.posts.hiddenAt,
      })
      .from(schema.posts)
      .innerJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
      .where(and(eq(schema.posts.id, id), isNull(schema.posts.deletedAt)));
      return row;
  }

  /**
   * 스크랩 목록에 보여줄 수 있는 글: 삭제되지 않았고, 비공개 게시판 글이면 본인 글이거나 관리자일 때만,
   * 비공개 처리한 글은 Super Admin일 때만 (스크랩한 뒤 글이 지워지거나 비공개가 된 경우 목록과 개수에서 빠진다)
   */
  private visibleScrapWhere(userId: string, canSeePrivate: boolean, canSeeHidden: boolean): SQL | undefined {
      return and(
          eq(schema.postScraps.userId, userId),
          isNull(schema.posts.deletedAt),
          canSeePrivate ? undefined : sql`(${schema.boards.isPrivate} = false or ${schema.posts.userId} = ${userId})`,
          canSeeHidden ? undefined : isNull(schema.posts.hiddenAt),
      );
  }

  async findScrappedPosts(userId: string, offset: number, limit: number, canSeePrivate = false, canSeeHidden = false, tx?: Transaction) {
      const db = tx ?? this.db;
      const rows = await db.select({
          post: POST_LIST_COLUMNS,
          user: {
              id: schema.users.id,
              name: schema.users.name,
              picture: schema.users.picture,
              role: schema.users.role,
          },
          board: {
              slug: schema.boards.slug,
              name: schema.boards.name,
          },
      })
      .from(schema.postScraps)
      .innerJoin(schema.posts, eq(schema.postScraps.postId, schema.posts.id))
      .innerJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
      .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
      .where(this.visibleScrapWhere(userId, canSeePrivate, canSeeHidden))
      .orderBy(desc(schema.postScraps.createdAt))
      .limit(limit)
      .offset(offset);
      return rows.map(({ post, user, board }: any) => ({ post: { ...post, user, board } }));
  }

  async countScrappedPosts(userId: string, canSeePrivate = false, canSeeHidden = false, tx?: Transaction) {
      const db = tx ?? this.db;
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
          .from(schema.postScraps)
          .innerJoin(schema.posts, eq(schema.postScraps.postId, schema.posts.id))
          .innerJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
          .where(this.visibleScrapWhere(userId, canSeePrivate, canSeeHidden));
      return result.count;
  }

  /**
   * 봇이 등록한 게시글별로 어느 수집 대상(갤러리)에서 가져왔는지 조회
   */
  async findBotSources(postIds: string[], tx?: Transaction) {
      if (postIds.length === 0) return [];
      const db = tx ?? this.db;
      return db
          .select({
              postId: schema.crawlerLogs.createdPostId,
              // 카드가 있으면 현재 카드 이름, 카드가 삭제됐으면 수집 당시 저장한 카드 이름
              targetName: sql<string | null>`coalesce(${schema.crawlerTargets.name}, ${schema.crawlerLogs.targetName})`,
              galleryId: schema.crawlerTargets.galleryId,
          })
          .from(schema.crawlerLogs)
          .leftJoin(schema.crawlerTargets, eq(schema.crawlerLogs.targetId, schema.crawlerTargets.id))
          .where(
              and(
                  inArray(schema.crawlerLogs.createdPostId, postIds),
                  eq(schema.crawlerLogs.status, 'SUCCESS'),
              ),
          );
  }

  async findUserById(userId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.users.findFirst({
          where: eq(schema.users.id, userId),
      });
  }

  // ---- 게시판 통째로 삭제 (관리자) ----

  /** 게시판의 모든 글(지운 글 포함). 크롤러 글은 crawled/ 이미지 정리를 위해 본문도 */
  async findBoardPostsForPurge(boardId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.select({
      id: schema.posts.id,
      isBot: schema.posts.isBot,
      content: sql<string | null>`case when ${schema.posts.isBot} then ${schema.posts.content} end`,
    })
    .from(schema.posts)
    .where(eq(schema.posts.boardId, boardId));
  }

  /** 게시판 글들에 달린 모든 댓글의 첨부 이미지 */
  async findCommentImagesByBoard(boardId: string, tx?: Transaction): Promise<string[]> {
    const db = tx ?? this.db;
    const rows = await db.select({ imageUrl: schema.comments.imageUrl })
      .from(schema.comments)
      .where(and(
        eq(schema.comments.targetType, 'post'),
        sql`${schema.comments.targetId} in (select ${schema.posts.id}::text from ${schema.posts} where ${schema.posts.boardId} = ${boardId})`,
        sql`${schema.comments.imageUrl} is not null`,
      ));
    return rows.map((row: { imageUrl: string | null }) => row.imageUrl as string);
  }

  /** 게시판의 댓글·글을 DB에서 지운다 (추천·스크랩은 글과 함께 지워짐) */
  async purgeBoardPosts(boardId: string, tx: Transaction) {
    await tx.delete(schema.comments).where(and(
      eq(schema.comments.targetType, 'post'),
      sql`${schema.comments.targetId} in (select ${schema.posts.id}::text from ${schema.posts} where ${schema.posts.boardId} = ${boardId})`,
    ));
    const deleted = await tx.delete(schema.posts).where(eq(schema.posts.boardId, boardId)).returning({ id: schema.posts.id });
    return deleted.length;
  }

  // ---- 사이트맵 ----

  /** 사이트맵에 넣을 글의 조건: 지워지지 않았고 비공개 처리하지 않은 사람 글(봇 글 제외), 공개·활성 게시판 */
  private sitemapWhere() {
    return and(
      isNull(schema.posts.deletedAt),
      isNull(schema.posts.hiddenAt),
      eq(schema.posts.isBot, false),
      eq(schema.boards.isPrivate, false),
      eq(schema.boards.isActive, true),
    );
  }

  async countSitemapPosts(tx?: Transaction): Promise<number> {
    const db = tx ?? this.db;
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .innerJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
      .where(this.sitemapWhere());
    return row.count;
  }

  /** 오래된 순으로 offset부터 limit개. 새 글은 마지막 조각에만 붙어 앞 조각은 거의 바뀌지 않는다 */
  async findSitemapPosts(offset: number, limit: number, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.select({
      id: schema.posts.id,
      boardSlug: schema.boards.slug,
      updatedAt: schema.posts.updatedAt,
    })
    .from(schema.posts)
    .innerJoin(schema.boards, eq(schema.posts.boardId, schema.boards.id))
    .where(this.sitemapWhere())
    .orderBy(asc(schema.posts.createdAt), asc(schema.posts.id))
    .limit(limit)
    .offset(offset);
  }
}
