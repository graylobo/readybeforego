import { CreatePostDto, ErrorCode, isAdmin, PointActionType, USER_ROLES } from '@community/shared-types';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and, eq, gte, ilike, isNull, or, SQL, sql } from 'drizzle-orm';
import { ApiException } from '../../common/exceptions/api.exception';
import { contentHasImage } from '../../common/utils/content-has-image';
import { sanitizeContent } from '../../common/utils/html-sanitizer';
import { omitGuestPassword } from '../../common/utils/omit-guest-password';
import { boards, posts, users } from '../../database/schema';
import { BoardsService } from '../boards/boards.service';
import { BoardManagersService } from '../boards/board-managers.service';
import { UploadsService } from '../uploads/uploads.service';
import { PostDeletedEvent, PostReactionEvent, PostUpdatedEvent } from './events/post-actions.events';
import { PostCreatedEvent } from './events/post-created.event';
import { PostsRepository } from './posts.repository';
import { PointsRevokeEvent } from '../points/events/points-revoke.event';

export interface BotSource {
  // 수집 대상 카드 이름 (디시 갤러리 이름이 아님)
  targetName: string | null;
  // 카드가 삭제된 경우 null
  galleryId: string | null;
}

/** 요청한 사용자. role은 인증 단계에서 읽은 값(req.user.role)을 넘겨받아 DB를 다시 조회하지 않는다 */
export interface Viewer {
  userId?: string;
  role?: string;
  ipAddress?: string;
}

export interface PostListQuery {
  boardSlug?: string;
  page?: number;
  limit?: number;
  searchType?: string;
  searchQuery?: string;
  authorId?: string;
  isBest?: boolean;
  /** true: 공지만, false: 공지 제외, 생략: 모두 */
  isNotice?: boolean;
  /** 본문 포함 여부 (목록형 화면은 본문이 필요 없어 기본 제외) */
  includeContent?: boolean;
}

const BEST_POST_MAX_DAYS = 7;
/** 사이트맵 조각 하나에 넣는 글 수 (사이트맵 규격의 한도 50,000) */
export const SITEMAP_CHUNK_SIZE = 50_000;
const MAX_LIST_LIMIT = 100;
// 게시판 첫 화면 상단에 함께 보여주는 공지/인기글 수
const BOARD_PAGE_NOTICE_LIMIT = 5;
const BOARD_PAGE_BEST_LIMIT = 10;
// 본문까지 목록에 보여주는 게시판 보기 방식
const CONTENT_VIEW_MODES = new Set(['feed', 'lounge']);

type PostListRow = Awaited<ReturnType<PostsRepository['searchPosts']>>[number];

// 검색어의 %, _ 를 문자 그대로 찾도록 이스케이프
function toLikePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function clampPage(page?: number): number {
  return Number.isFinite(page) && (page as number) >= 1 ? Math.floor(page as number) : 1;
}

function clampLimit(limit: number | undefined, fallback: number): number {
  if (!Number.isFinite(limit) || (limit as number) < 1) return fallback;
  return Math.min(Math.floor(limit as number), MAX_LIST_LIMIT);
}

/** 크롤러가 가져온 이미지 폴더 (crawler 서비스의 업로드 폴더와 같아야 함) */
const CRAWLED_FOLDER = 'crawled';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  constructor(
    private readonly boardsService: BoardsService,
    private readonly boardManagers: BoardManagersService,
    private readonly uploadsService: UploadsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly postsRepo: PostsRepository,
  ) {}

  /**
   * 게시글 목록
   */
  async findAll(query: PostListQuery, viewer: Viewer = {}) {
      const role = await this.resolveRole(viewer);
      const scope = await this.resolveListScope(query.boardSlug, viewer, role);
      if (!scope) return { items: [], total: 0 };

      const page = clampPage(query.page);
      const limit = clampLimit(query.limit, 20);
      const where = this.buildListWhere(scope, query);

      const [rows, total] = await Promise.all([
          this.postsRepo.searchPosts(where, (page - 1) * limit, limit, !!query.includeContent),
          this.postsRepo.countPosts(where),
      ]);
      const [items] = await this.decorateLists([rows], viewer, role);
      return { items, total };
  }

  /**
   * 게시판 화면 한 번에 필요한 데이터: 게시판 정보 + (첫 페이지면) 공지/인기글 + 게시글 목록
   * 화면이 API를 여러 번 부르지 않도록 한 요청으로 묶고, 서버에서는 동시에 조회한다.
   */
  async getBoardPage(
      slug: string,
      query: Pick<PostListQuery, 'page' | 'limit' | 'searchType' | 'searchQuery'>,
      viewer: Viewer = {},
  ) {
      const [board, role] = await Promise.all([
          this.boardsService.findBySlug(slug),
          this.resolveRole(viewer),
      ]);
      if (!board) throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);

      const page = clampPage(query.page);
      const limit = clampLimit(query.limit, 30);
      const isSearching = !!query.searchQuery?.trim();
      // 첫 페이지 일반 목록에서만 공지/인기글을 위에 따로 보여주고, 본 목록에서는 공지를 뺀다
      const showBlocks = slug !== 'best' && slug !== 'all' && !isSearching && page === 1;
      const includeContent = CONTENT_VIEW_MODES.has(board.viewMode);
      const emptyPage = { board, notices: [], best: [], posts: { items: [], total: 0 } };

      const scope = await this.resolveListScope(slug, viewer, role);
      if (!scope) return emptyPage;

      const mainWhere = this.buildListWhere(scope, {
          ...query,
          isNotice: showBlocks ? false : undefined,
      });
      const noticeWhere = showBlocks ? this.buildListWhere(scope, { isNotice: true }) : null;
      const bestWhere = showBlocks ? this.buildListWhere(scope, { isBest: true, isNotice: false }) : null;

      const [mainRows, total, noticeRows, bestRows] = await Promise.all([
          this.postsRepo.searchPosts(mainWhere, (page - 1) * limit, limit, includeContent),
          this.postsRepo.countPosts(mainWhere),
          noticeWhere ? this.postsRepo.searchPosts(noticeWhere, 0, BOARD_PAGE_NOTICE_LIMIT, includeContent) : [],
          bestWhere ? this.postsRepo.searchPosts(bestWhere, 0, BOARD_PAGE_BEST_LIMIT, includeContent) : [],
      ]);

      const [items, notices, best] = await this.decorateLists([mainRows, noticeRows, bestRows], viewer, role);
      return { board, notices, best, posts: { items, total } };
  }

  /**
   * 목록 대상 게시판 범위. 결과가 비어야 하는 경우(비공개 게시판에 비로그인 등) null
   */
  private async resolveListScope(
      boardSlug: string | undefined,
      viewer: Viewer,
      role: string | undefined,
  ): Promise<SQL[] | null> {
      // 비공개 처리한 글은 Super Admin 목록에만 나온다
      const visibility = this.canSeeHidden(role) ? [] : [isNull(posts.hiddenAt)];
      // 전체/베스트: 공개 게시판의 글만 (게시판 조인 조건으로 거름)
      if (!boardSlug || boardSlug === 'all') return [eq(boards.isPrivate, false), ...visibility];
      if (boardSlug === 'best') {
          return [eq(boards.isPrivate, false), ...visibility, ...this.bestConditions()];
      }

      const board = await this.boardsService.findBySlug(boardSlug);
      if (!board) throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);

      const conditions: SQL[] = [eq(posts.boardId, board.id), ...visibility];
      if (board.isPrivate) {
          // 비공개 게시판: 비로그인은 빈 목록, 일반 회원은 자기 글만, 관리자는 전체
          if (!viewer.userId) return null;
          if (!isAdmin(role as any)) conditions.push(eq(posts.userId, viewer.userId));
      }
      return conditions;
  }

  private bestConditions(): SQL[] {
      // 최근 BEST_POST_MAX_DAYS일 이내 작성된 인기글만 노출
      const limitDaysAgo = new Date(Date.now() - BEST_POST_MAX_DAYS * 24 * 60 * 60 * 1000);
      return [eq(posts.isBest, true), gte(posts.createdAt, limitDaysAgo)];
  }

  private buildListWhere(scope: SQL[], query: Omit<PostListQuery, 'boardSlug'>): SQL | undefined {
      const conditions: (SQL | undefined)[] = [isNull(posts.deletedAt), ...scope];

      if (query.authorId) conditions.push(eq(posts.userId, query.authorId));
      if (query.isBest) conditions.push(...this.bestConditions());
      if (query.isNotice !== undefined) conditions.push(eq(posts.isNotice, query.isNotice));

      const searchQuery = query.searchQuery?.trim();
      if (searchQuery) {
          const q = toLikePattern(searchQuery);
          switch (query.searchType) {
              case 'title':
                  conditions.push(ilike(posts.title, q));
                  break;
              case 'content':
                  conditions.push(ilike(posts.content, q));
                  break;
              case 'nickname':
                  // 회원 닉네임은 하위 쿼리로 찾아 작성자 조인 없이 거른다 (닉네임/비회원 이름 모두 검색 인덱스 사용)
                  conditions.push(
                      or(
                          sql`${posts.userId} in (select ${users.id} from ${users} where ${users.name} ilike ${q})`,
                          ilike(posts.guestName, q),
                      ),
                  );
                  break;
              default:
                  conditions.push(or(ilike(posts.title, q), ilike(posts.content, q)));
          }
      }

      return and(...conditions.filter((c): c is SQL => !!c));
  }

  /**
   * 목록 행에 내 반응/봇 출처를 붙여 응답용으로 변환. 여러 목록을 한 번의 조회로 함께 처리한다.
   */
  private async decorateLists(lists: PostListRow[][], viewer: Viewer, role: string | undefined) {
      const showBotFlag = this.canSeeBotFlag(role);
      const allPosts = lists.flat().map(({ post }) => post);
      const postIds = [...new Set(allPosts.map((p) => p.id))];

      const [userReactions, botSources] = await Promise.all([
          viewer.userId && postIds.length > 0
              ? this.postsRepo.getUserReactionsForPosts(postIds, viewer.userId)
              : Promise.resolve([]),
          this.getBotSources(allPosts, showBotFlag),
      ]);
      const userReactionMap = new Map(userReactions.map((r) => [r.postId, r.type]));

      return lists.map((rows) =>
          rows.map(({ post, user, board }) => ({
              ...this.toPublicPost(post, showBotFlag, botSources),
              user,
              board,
              userReaction: userReactionMap.get(post.id) ?? null,
          })),
      );
  }

  /**
   * 조회수 기록. 상세 화면은 서버 렌더링 결과를 그대로 쓰고, 조회수만 이 가벼운 요청으로 올린다
   */
  async recordView(id: string) {
      const viewCount = await this.postsRepo.incrementViewCount(id);
      if (viewCount === undefined) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
      return { viewCount };
  }

  async findOne(id: string, viewer: Viewer = {}) {
      const [post, role] = await Promise.all([
          this.postsRepo.findByIdWithDetails(id),
          this.resolveRole(viewer),
      ]);

      if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);

      this.assertCanAccessPost({ isPrivate: post.board.isPrivate, userId: post.userId, hiddenAt: post.hiddenAt }, viewer, role);

      const showBotFlag = this.canSeeBotFlag(role);

      // 접근 확인이 끝난 뒤의 조회/갱신은 서로 독립적이므로 동시에 실행 (DB 왕복을 차례대로 쌓지 않음)
      const [reaction, scrap, botSources] = await Promise.all([
          // 내 반응 (회원은 계정, 비회원은 IP 기준)
          this.postsRepo.findUserReaction(id, viewer.userId, viewer.ipAddress),
          viewer.userId ? this.postsRepo.findUserScrap(id, viewer.userId) : Promise.resolve(null),
          this.getBotSources([post], showBotFlag),
      ]);

      const publicPost = this.toPublicPost(post, showBotFlag, botSources);
      return {
          ...publicPost,
          // 크롤러가 가져온 글은 검색 결과에 넣지 않는다 (화면이 noindex를 붙임). 사람이 쓴 글은 그대로 검색에 나온다
          noIndex: post.isBot || !!post.hiddenAt,
          // 상세 화면은 본문 HTML을 그대로 렌더링하므로, 정화 이전에 저장된 글이 있어도 안전하도록 응답 시 한 번 더 정화
          content: sanitizeContent(publicPost.content),
          userReaction: (reaction?.type ?? null) as 'like' | 'dislike' | null,
          isScrapped: !!scrap,
      };
  }

  /**
   * 비공개 게시판 글은 작성자/관리자만 보거나(추천·스크랩 포함) 다룰 수 있다.
   * 비공개 처리한 글(hiddenAt)은 Super Admin 말고는 작성자에게도 없는 글(404)로 보인다
   */
  private assertCanAccessPost(
      post: { isPrivate: boolean; userId: string | null; hiddenAt: Date | null },
      viewer: Viewer,
      role: string | undefined,
  ) {
      if (post.hiddenAt && !this.canSeeHidden(role)) {
          throw new ApiException(ErrorCode.POST_HIDDEN, HttpStatus.NOT_FOUND);
      }
      if (!post.isPrivate) return;
      if (!viewer.userId) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
      if (!isAdmin(role as any) && post.userId !== viewer.userId) {
          throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
      }
  }

  /**
   * 봇 등록 글 여부(isBot)는 Super Admin에게만 내려준다.
   * 화면에서만 숨기면 응답(개발자 도구)으로 봇 글을 구분할 수 있으므로 응답에서 제외한다.
   */
  private canSeeBotFlag(role?: string): boolean {
      return role === USER_ROLES.SUPER_ADMIN;
  }

  /** 비공개 처리한 글을 보고, 비공개/공개로 바꿀 수 있는 사람 (Super Admin만) */
  private canSeeHidden(role?: string): boolean {
      return role === USER_ROLES.SUPER_ADMIN;
  }

  /**
   * 게시글 비공개/공개 전환 (Super Admin). 글과 댓글은 그대로 두고 Super Admin 말고는 안 보이게만 한다
   */
  async setHidden(id: string, viewer: Viewer, hidden: boolean) {
      if (!viewer.userId) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
      if (!this.canSeeHidden(await this.resolveRole(viewer))) {
          throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
      }
      const post = await this.postsRepo.findById(id);
      if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
      // 이미 비공개인 글을 다시 비공개로 해도 처음 비공개한 시각은 바꾸지 않는다
      const hiddenAt = hidden ? post.hiddenAt ?? new Date() : null;
      await this.postsRepo.updatePost(id, { hiddenAt });
      return { hiddenAt };
  }

  /**
   * 요청 사용자의 역할. 인증 단계에서 이미 읽은 역할을 넘겨받으면 DB를 다시 조회하지 않는다.
   */
  private async resolveRole(viewer: Viewer): Promise<string | undefined> {
      if (!viewer.userId) return undefined;
      if (viewer.role) return viewer.role;
      const currentUser = await this.postsRepo.findUserById(viewer.userId);
      return currentUser?.role;
  }

  /**
   * Super Admin일 때만, 봇 게시글이 어느 수집 대상(갤러리)에서 왔는지 postId별로 조회
   */
  private async getBotSources(
      postList: { id: string; isBot: boolean }[],
      showBotFlag: boolean,
  ): Promise<Map<string, BotSource>> {
      const sources = new Map<string, BotSource>();
      if (!showBotFlag) return sources;
      const botPostIds = postList.filter((p) => p.isBot).map((p) => p.id);
      const rows = await this.postsRepo.findBotSources(botPostIds);
      rows.forEach(({ postId, targetName, galleryId }) => {
          if (postId) sources.set(postId, { targetName, galleryId });
      });
      return sources;
  }

  /**
   * 게시글을 응답용으로 변환: 비밀번호 해시는 항상 제외하고,
   * isBot과 봇 출처(botSource)는 Super Admin일 때만 남긴다.
   */
  private toPublicPost<T extends { id: string; isBot: boolean; guestPassword?: string | null }>(
      post: T,
      showBotFlag: boolean,
      botSources?: Map<string, BotSource>,
  ): Omit<T, 'guestPassword' | 'isBot'> & { isBot?: boolean; botSource?: BotSource | null } {
      const publicPost: Partial<T> = omitGuestPassword(post) as Partial<T>;
      if (!showBotFlag) {
          delete publicPost.isBot;
          return publicPost as Omit<T, 'guestPassword' | 'isBot'>;
      }
      return {
          ...(publicPost as Omit<T, 'guestPassword' | 'isBot'>),
          isBot: post.isBot,
          botSource: post.isBot ? botSources?.get(post.id) ?? null : null,
      };
  }

  private async hashPassword(password: string): Promise<string> {
      const salt = await bcrypt.genSalt(10);
      return bcrypt.hash(password, salt);
  }

  private async comparePassword(password: string, hash: string): Promise<boolean> {
      return bcrypt.compare(password, hash);
  }

  /**
   * 수정/삭제 권한 확인. 회원 글은 작성자 또는 관리자, 비회원 글은 비밀번호 일치 또는 관리자
   */
  private async assertCanModify(
      post: { userId: string | null; guestPassword: string | null },
      viewer: Viewer,
      guestPassword?: string,
  ) {
      if (post.userId) {
          if (post.userId === viewer.userId) return;
          if (!viewer.userId) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
          if (!isAdmin((await this.resolveRole(viewer)) as any)) {
              throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
          }
          return;
      }

      const isPasswordValid = guestPassword
          ? await this.comparePassword(guestPassword, post.guestPassword || '')
          : false;
      if (isPasswordValid) return;
      if (viewer.userId && isAdmin((await this.resolveRole(viewer)) as any)) return;
      throw new ApiException(ErrorCode.POST_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
  }

  async create(viewer: Viewer, boardSlug: string, dto: CreatePostDto, userAgent?: string) {
      const userId = viewer.userId ?? null;
      const board = await this.boardsService.findBySlug(boardSlug);
      // 전체/베스트는 글을 모아 보여주기만 하는 화면이라 글을 쓸 수 없다
      if (!board || boardSlug === 'best' || boardSlug === 'all') throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);
      const role = await this.resolveRole(viewer);
      if (board.isReadOnly && !isAdmin(role as any)) {
          throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, '읽기 전용 게시판이라 새 글을 쓸 수 없습니다.');
      }

      if (board.isPrivate && !userId) {
          throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
      }

      // 익명 작성 권한 확인
      if (!userId && !board.allowAnonymous) {
          throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, '이 게시판은 익명 작성을 허용하지 않습니다.');
      }
      // 비회원 글은 비밀번호로만 수정/삭제할 수 있으므로 반드시 받는다
      if (!userId && !dto.guestPassword) {
          throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.BAD_REQUEST, '비밀번호를 입력해주세요.');
      }

      // id를 미리 정해 본문의 임시 이미지를 게시글 폴더로 먼저 옮긴 뒤 한 번에 저장 (저장 후 다시 수정하지 않음)
      const postId = randomUUID();
      const content = await this.uploadsService.moveTempImages(sanitizeContent(dto.content), `posts/${postId}`);

      const newPostData: any = {
          id: postId,
          boardId: board.id,
          userId,
          title: dto.title,
          category: dto.category,
          content,
          hasImage: contentHasImage(content),
          guestName: userId ? null : dto.guestName?.trim() || '익명',
          guestPassword: !userId && dto.guestPassword ? await this.hashPassword(dto.guestPassword) : null,
          allowComments: dto.allowComments !== undefined ? dto.allowComments : true,
          receiveCommentNotification: dto.receiveCommentNotification !== undefined ? dto.receiveCommentNotification : true,
      };

      // 공지·고정은 이 게시판 관리자(매니저·부매니저)와 사이트 관리자, 인기글 지정은 사이트 관리자만
      if (userId && (await this.boardManagers.canModerate(board.id, { userId, role }))) {
          if (dto.isNotice !== undefined) newPostData.isNotice = dto.isNotice;
          if (dto.isPinned !== undefined) newPostData.isPinned = dto.isPinned;
      }
      if (userId && isAdmin(role as any) && dto.isBest !== undefined) newPostData.isBest = dto.isBest;

      const newPost = await this.postsRepo.createPost(newPostData);

      if (userId) {
          this.eventEmitter.emit(
              'post.created',
              new PostCreatedEvent(userId, newPost.id, newPost.title, board.name, viewer.ipAddress, userAgent),
          );
      }

      return omitGuestPassword(newPost);
  }

  async update(id: string, viewer: Viewer, data: {
      title?: string;
      content?: string;
      guestPassword?: string;
      isPinned?: boolean;
      isNotice?: boolean;
      isBest?: boolean;
      allowComments?: boolean;
      receiveCommentNotification?: boolean;
  }, userAgent?: string) {
      const post = await this.postsRepo.findById(id);
      if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);

      const role = await this.resolveRole(viewer);
      const isModerator = await this.boardManagers.canModerate(post.boardId, { userId: viewer.userId, role });
      // 게시판 관리자는 남의 글 내용은 고칠 수 없고 공지·고정만 바꿀 수 있다
      const onlyModeration =
          data.title === undefined && data.content === undefined &&
          data.allowComments === undefined && data.receiveCommentNotification === undefined;
      if (!(isModerator && onlyModeration)) {
          await this.assertCanModify(post, viewer, data.guestPassword);
      }

      const updates: any = {
          updatedAt: new Date(),
      };
      if (data.title !== undefined) updates.title = data.title;
      if (data.content !== undefined) {
          updates.content = await this.uploadsService.moveTempImages(sanitizeContent(data.content), `posts/${id}`);
          updates.hasImage = contentHasImage(updates.content);
      }
      if (data.allowComments !== undefined) updates.allowComments = data.allowComments;
      if (data.receiveCommentNotification !== undefined) updates.receiveCommentNotification = data.receiveCommentNotification;

      // 공지·고정은 게시판 관리자와 사이트 관리자, 인기글 지정은 사이트 관리자만
      if (isModerator) {
          if (data.isPinned !== undefined) updates.isPinned = data.isPinned;
          if (data.isNotice !== undefined) updates.isNotice = data.isNotice;
      }
      if (viewer.userId && isAdmin(role as any) && data.isBest !== undefined) updates.isBest = data.isBest;

      const updated = await this.postsRepo.updatePost(id, updates);

      // 수정한 본문에서 지워진 이미지는 응답을 기다리게 하지 않고 뒤에서 스토리지에서 삭제
      if (updates.content !== undefined && post.content) {
          this.uploadsService.cleanupOrphanImages(post.content, updates.content, `posts/${id}`).catch((err) => {
              this.logger.error(`Failed to clean up orphan images for post ${id}:`, err);
          });
          if (post.isBot) {
              this.uploadsService.cleanupOrphanImages(post.content, updates.content, CRAWLED_FOLDER).catch((err) => {
                  this.logger.error(`Failed to clean up orphan crawled images for post ${id}:`, err);
              });
          }
      }

      if (viewer.userId && updated) {
          this.eventEmitter.emit(
              'post.updated',
              new PostUpdatedEvent(viewer.userId, updated.id, updated.title, viewer.ipAddress, userAgent),
          );
      }

      return omitGuestPassword(updated);
  }

  async remove(id: string, viewer: Viewer, guestPassword?: string, userAgent?: string) {
      const post = await this.postsRepo.findById(id);
      if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);

      // 게시판 관리자(매니저·부매니저)는 자기 게시판의 글을 지울 수 있다
      const role = await this.resolveRole(viewer);
      if (!(await this.boardManagers.canModerate(post.boardId, { userId: viewer.userId, role }))) {
          await this.assertCanModify(post, viewer, guestPassword);
      }

      // 게시글에 달린 댓글들의 이미지 URL 사전 수집 (고아 이미지 방지), 글쓴이 본인 댓글(포인트 회수용)
      const [commentImages, authorCommentIds] = await Promise.all([
          this.postsRepo.findCommentImagesByPost(id),
          post.userId ? this.postsRepo.findAuthorCommentIds(id, post.userId) : Promise.resolve([]),
      ]);

      await this.postsRepo.transaction(async (tx) => {
          await this.postsRepo.softDeletePost(id, tx);
          await this.postsRepo.softDeleteCommentsByPost(id, tx);
      });

      // 크롤러가 가져온 글의 이미지는 posts/{id} 가 아닌 crawled/ 에 있어 본문 주소로 찾아 지운다.
      // 크롤러 글(isBot)만 정리한다: 일반 글 본문에 다른 글의 crawled 이미지 주소를 붙여 넣었을 수 있기 때문
      const crawledImagePaths = post.isBot ? this.uploadsService.extractImagePaths(post.content ?? '', CRAWLED_FOLDER) : [];

      // 스토리지 이미지 정리는 응답을 기다리게 하지 않고 뒤에서 동시에 처리
      void this.deletePostImages(id, commentImages, crawledImagePaths);

      // 지운 글(과 글쓴이가 그 글에 단 댓글)로 받은 포인트를 되돌린다. 다른 사람의 댓글 포인트는 그대로 둔다
      if (post.userId) {
          this.eventEmitter.emit('points.revoke', new PointsRevokeEvent(post.userId, PointActionType.POST_CREATED, post.id, 'post'));
          for (const commentId of authorCommentIds) {
              this.eventEmitter.emit('points.revoke', new PointsRevokeEvent(post.userId, PointActionType.COMMENT_CREATED, commentId, 'comment'));
          }
      }

      if (viewer.userId) {
          this.eventEmitter.emit(
              'post.deleted',
              new PostDeletedEvent(viewer.userId, post.id, post.title, viewer.ipAddress, userAgent),
          );
      }

      return { success: true };
  }

  private async deletePostImages(postId: string, commentImages: string[], contentImagePaths: string[] = []) {
      const tasks: Promise<unknown>[] = [
          this.uploadsService.deleteDirectory(`posts/${postId}`).catch((err) => {
              this.logger.error(`Failed to delete images for post ${postId}:`, err);
          }),
          ...contentImagePaths.map((path) =>
              this.uploadsService.deleteImage(path).catch((err) => {
                  this.logger.error(`Failed to delete content image ${path} for post ${postId}:`, err);
              }),
          ),
      ];
      for (const imageUrl of new Set(commentImages)) {
          const imagePath = this.uploadsService.extractCommentImagePath(imageUrl);
          if (!imagePath) continue;
          tasks.push(
              this.uploadsService.deleteImage(imagePath).catch((err) => {
                  this.logger.error(`Failed to delete comment image ${imageUrl} for post ${postId}:`, err);
              }),
          );
      }
      await Promise.all(tasks);
  }

  /**
   * 게시판을 글·댓글까지 통째로 삭제 (사이트 관리자). DB는 한 번에 지우고, 저장소 이미지는 응답을 기다리게 하지 않고 뒤에서 정리한다.
   * 지운 글로 받은 포인트는 회수하지 않는다 (관리자가 게시판을 정리한 것이지 작성자가 지운 것이 아님)
   */
  async deleteBoardWithPosts(boardId: string) {
      const board = await this.boardsService.findById(boardId);
      if (!board) throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);

      const [boardPosts, commentImages] = await Promise.all([
          this.postsRepo.findBoardPostsForPurge(boardId),
          this.postsRepo.findCommentImagesByBoard(boardId),
      ]);
      const deletedPosts = await this.postsRepo.transaction(async (tx) => {
          const count = await this.postsRepo.purgeBoardPosts(boardId, tx);
          await this.boardsService.deleteInTransaction(boardId, tx);
          return count;
      });
      this.boardsService.invalidateCache();

      void this.cleanupPurgedImages(boardPosts, commentImages).catch((err) => {
          this.logger.error(`Failed to clean up images for deleted board ${boardId}:`, err);
      });
      return { deletedPosts };
  }

  private async cleanupPurgedImages(boardPosts: { id: string; isBot: boolean; content: string | null }[], commentImages: string[]) {
      const tasks: (() => Promise<unknown>)[] = [];
      for (const post of boardPosts) {
          tasks.push(() => this.uploadsService.deleteDirectory(`posts/${post.id}`));
          if (post.isBot && post.content) {
              for (const path of this.uploadsService.extractImagePaths(post.content, CRAWLED_FOLDER)) {
                  tasks.push(() => this.uploadsService.deleteImage(path));
              }
          }
      }
      for (const url of new Set(commentImages)) {
          const path = this.uploadsService.extractCommentImagePath(url);
          if (path) tasks.push(() => this.uploadsService.deleteImage(path));
      }
      // 글이 많은 게시판도 저장소에 요청을 한꺼번에 몰아 보내지 않도록 10개씩 나눠 처리
      for (let i = 0; i < tasks.length; i += 10) {
          await Promise.all(tasks.slice(i, i + 10).map((task) => task().catch((err) => this.logger.error('Image cleanup failed:', err))));
      }
  }

  /** 사이트맵: 넣을 글 수와 조각 크기 (화면이 조각 수를 계산한다) */
  async getSitemapSummary() {
      return { total: await this.postsRepo.countSitemapPosts(), chunkSize: SITEMAP_CHUNK_SIZE };
  }

  /** 사이트맵 n번째 조각의 글 (id, 게시판 주소, 수정 시각만) */
  async getSitemapChunk(chunk: number) {
      const index = Number.isFinite(chunk) && chunk >= 0 ? Math.floor(chunk) : 0;
      return this.postsRepo.findSitemapPosts(index * SITEMAP_CHUNK_SIZE, SITEMAP_CHUNK_SIZE);
  }

  async verifyPassword(id: string, password: string) {
      const post = await this.postsRepo.findPostPassword(id);

      if (!post || !post.guestPassword) {
          throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
      }

      const isValid = await this.comparePassword(password, post.guestPassword);
      if (!isValid) {
          throw new ApiException(ErrorCode.POST_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
      }

      return { success: true };
  }

  /**
   * 추천/비추천 토글. 게시글에 저장된 추천 수를 변화량만큼만 갱신한다 (매번 전체 반응을 세지 않음)
   */
  async toggleReaction(id: string, viewer: Viewer, type: 'like' | 'dislike', userAgent?: string) {
    const { userId, ipAddress } = viewer;
    if (!userId && !ipAddress) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
    let reactionEvent: PostReactionEvent | null = null;

    const result = await this.postsRepo.transaction(async (tx) => {
        const post = await this.postsRepo.findReactionTarget(id, tx);
        if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
        if (post.isPrivate || post.hiddenAt) this.assertCanAccessPost(post, viewer, await this.resolveRole(viewer));

        const existing = await this.postsRepo.findUserReaction(id, userId, ipAddress, tx);
        const delta = { like: 0, dislike: 0 };
        let userReaction: 'like' | 'dislike' | null;

        // 동시에 같은 요청이 와도 실제로 바뀐 행이 있을 때만 수치를 바꾼다
        if (existing && existing.type === type) {
            if (await this.postsRepo.deleteReaction(existing.id, tx)) delta[type] -= 1;
            userReaction = null;
        } else if (existing) {
            if (await this.postsRepo.updateReaction(existing.id, existing.type, type, tx)) {
                delta[existing.type] -= 1;
                delta[type] += 1;
            }
            userReaction = type;
        } else {
            const inserted = await this.postsRepo.createReaction({
                postId: id,
                userId: userId || null,
                ipAddress: userId ? null : ipAddress,
                type,
            }, tx);
            if (inserted) delta[type] += 1;
            userReaction = type;
        }

        const counts = await this.postsRepo.applyReactionDelta(id, delta.like, delta.dislike, tx);
        if (counts.isBest && !post.isBest) {
            this.logger.log(`Post ${post.id} promoted to Best Post!`);
        }

        if (userId && userReaction === 'like' && post.userId) {
            reactionEvent = new PostReactionEvent(
                userId,
                post.id,
                post.title,
                post.userId,
                post.boardSlug,
                userReaction,
                ipAddress,
                userAgent
            );
        }

        return {
            likeCount: counts.likeCount,
            dislikeCount: counts.dislikeCount,
            userReaction,
        };
    });

    if (reactionEvent) {
        this.eventEmitter.emit('post.reaction', reactionEvent);
    }

    return result;
  }

  async toggleScrap(postId: string, viewer: Viewer & { userId: string }) {
      const post = await this.postsRepo.findReactionTarget(postId);
      if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
      if (post.isPrivate || post.hiddenAt) this.assertCanAccessPost(post, viewer, await this.resolveRole(viewer));
      return { isScrapped: await this.postsRepo.toggleScrap(postId, viewer.userId) };
  }

  async findScrappedPosts(viewer: Viewer & { userId: string }, page: number = 1, limit: number = 20) {
      page = clampPage(page);
      limit = clampLimit(limit, 20);
      const offset = (page - 1) * limit;

      const role = await this.resolveRole(viewer);
      const canSeePrivate = isAdmin(role as any);
      const canSeeHidden = this.canSeeHidden(role);
      const [items, totalCount] = await Promise.all([
          this.postsRepo.findScrappedPosts(viewer.userId, offset, limit, canSeePrivate, canSeeHidden),
          this.postsRepo.countScrappedPosts(viewer.userId, canSeePrivate, canSeeHidden),
      ]);
      const showBotFlag = this.canSeeBotFlag(role);
      const botSources = await this.getBotSources(items.map((item) => item.post), showBotFlag);

      return {
          items: items.map(item => this.toPublicPost(item.post, showBotFlag, botSources)).map(item => {
              // Flattening for PostList component which expects items: { post, user, board }
              const { user, board, ...postData } = item;
              return {
                  post: postData,
                  user: user,
                  board: board
              };
          }),
          total: totalCount,
      };
  }
}
