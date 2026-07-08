import { CreatePostDto, ErrorCode, isAdmin } from '@community/shared-types';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { and, eq, ilike, inArray, isNull, or, SQL, gte } from 'drizzle-orm';
import { ApiException } from '../../common/exceptions/api.exception';
import { sanitizeContent } from '../../common/utils/html-sanitizer';
import { posts, users } from '../../database/schema';
import { BoardsService } from '../boards/boards.service';
import { UploadsService } from '../uploads/uploads.service';
import { PostDeletedEvent, PostReactionEvent, PostUpdatedEvent } from './events/post-actions.events';
import { PostCreatedEvent } from './events/post-created.event';
import { PostsRepository } from './posts.repository';

const BEST_POST_MAX_DAYS = 7;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  constructor(
    private readonly boardsService: BoardsService,
    private readonly uploadsService: UploadsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly postsRepo: PostsRepository,
  ) {}

  async findAll(
    boardSlug?: string, 
    page: number = 1, 
    limit: number = 20,
    searchType?: string,
    searchQuery?: string,
    currentUserId?: string,
    authorId?: string,
    isBest?: string,
    isNotice?: string
  ) {
      const offset = (page - 1) * limit;
      const conditions: (SQL | undefined)[] = [isNull(posts.deletedAt)];

      if (authorId) {
        conditions.push(eq(posts.userId, authorId));
      }

      if (isBest === 'true') {
        conditions.push(eq(posts.isBest, true));
        // 최근 BEST_POST_MAX_DAYS일 이내 작성된 인기글만 노출
        const limitDaysAgo = new Date(Date.now() - BEST_POST_MAX_DAYS * 24 * 60 * 60 * 1000);
        conditions.push(gte(posts.createdAt, limitDaysAgo));
      }

      if (isNotice === 'true') {
        conditions.push(eq(posts.isNotice, true));
      } else if (isNotice === 'false') {
        conditions.push(eq(posts.isNotice, false));
      }

      if (boardSlug && boardSlug !== 'all') {
          if (boardSlug === 'best') {
              if (isBest !== 'true') {
                  conditions.push(eq(posts.isBest, true));
                  const limitDaysAgo = new Date(Date.now() - BEST_POST_MAX_DAYS * 24 * 60 * 60 * 1000);
                  conditions.push(gte(posts.createdAt, limitDaysAgo));
              }
              
              // 전역 베스트: 공개 게시판의 글만 모아서 보여줌
              const publicBoards = await this.postsRepo.findPublicBoards();
              const ids = publicBoards.map(b => b.id);
              if (ids.length === 0) return { items: [], total: 0 };
              
              conditions.push(inArray(posts.boardId, ids));
          } else {
              const board = await this.boardsService.findBySlug(boardSlug);
              if (!board) throw new Error('Board not found');
              
              conditions.push(eq(posts.boardId, board.id));

              // Handle private board visibility
              if (board.isPrivate) {
                  if (!currentUserId) {
                      return { items: [], total: 0 };
                  }
                  
                  const currentUser = await this.postsRepo.findUserById(currentUserId);

                  if (!isAdmin(currentUser?.role as any)) {
                      conditions.push(eq(posts.userId, currentUserId));
                  }
              }
          }
      } else {
          // Global search: Only show posts from public boards
          const publicBoards = await this.postsRepo.findPublicBoards();
          
          const ids = publicBoards.map(b => b.id);
          if (ids.length === 0) return { items: [], total: 0 };
          
          conditions.push(inArray(posts.boardId, ids));
      }

      if (searchQuery) {
          const q = `%${searchQuery}%`;
          if (searchType === 'title') {
              conditions.push(ilike(posts.title, q));
          } else if (searchType === 'content') {
              conditions.push(ilike(posts.content, q));
          } else if (searchType === 'titleContent') {
              conditions.push(or(ilike(posts.title, q), ilike(posts.content, q)));
          } else if (searchType === 'nickname') {
              conditions.push(or(ilike(users.name, q), ilike(posts.guestName, q)));
          }
      }

      const whereClause = and(...conditions.filter((c): c is SQL => !!c));

      // Get items with user and board join to support global links and search
      const items = await this.postsRepo.searchPosts(whereClause, offset, limit);

      // Get total count for pagination
      const totalCount = await this.postsRepo.countPosts(whereClause);

      // Get all reaction counts for the posts in one query to avoid N+1
      const postIds = items.map(({ post }) => post.id);
      
      const allReactionCounts = await this.postsRepo.getReactionCountsForPosts(postIds);

      const reactionMap = allReactionCounts.reduce((acc, curr) => {
        if (!acc[curr.postId]) acc[curr.postId] = { like: 0, dislike: 0 };
        acc[curr.postId][curr.type] = curr.count;
        return acc;
      }, {} as Record<string, { like: number, dislike: number }>);

      // Fetch user reactions for post list if logged in
      let userReactionMap: Record<string, 'like' | 'dislike' | null> = {};
      if (currentUserId && postIds.length > 0) {
          const userReactions = await this.postsRepo.getUserReactionsForPosts(postIds, currentUserId);
          userReactionMap = userReactions.reduce((acc, curr) => {
              acc[curr.postId] = curr.type;
              return acc;
          }, {} as Record<string, 'like' | 'dislike' | null>);
      }

      const itemsWithCounts = items.map(({ post, user, board }) => {
          const counts = reactionMap[post.id] || { like: 0, dislike: 0 };
          const hasImage = /<img[^>]+src=[^>]+>|!\[[^\]]*\]\([^)]+\)/.test(post.content || '');
          const userReaction = userReactionMap[post.id] || null;

          return {
              ...post,
              user,
              board,
              likeCount: counts.like,
              dislikeCount: counts.dislike,
              commentCount: post.commentCount,
              userReaction,
              hasImage,
          };
      });
      
      return {
          items: itemsWithCounts,
          total: totalCount,
      };
  }

  async findOne(id: string, currentUserId?: string, incrementView: boolean = false, ipAddress?: string) {
      const post = await this.postsRepo.findByIdWithDetails(id);

      if (!post) throw new Error('Post not found');

      // Private board access check
      if (post.board.isPrivate) {
          if (!currentUserId) throw new Error('Private post access denied');
          
          const currentUser = await this.postsRepo.findUserById(currentUserId);

          if (!isAdmin(currentUser?.role as any) && post.userId !== currentUserId) {
              throw new Error('Private post access denied');
          }
      }

      let viewCount = post.viewCount;
      if (incrementView) {
          // Increment view count atomically
          await this.postsRepo.incrementViewCount(id);
          viewCount = post.viewCount + 1;
      }

      // Fetch Reaction Counts
      const reactionCounts = await this.postsRepo.getReactionCountsForPost(id);

      const likeCount = reactionCounts.find(r => r.type === 'like')?.count || 0;
      const dislikeCount = reactionCounts.find(r => r.type === 'dislike')?.count || 0;

      // Fetch User Reaction (by userId or ipAddress)
      const reaction = await this.postsRepo.findUserReaction(id, currentUserId, ipAddress);
      let userReaction: 'like' | 'dislike' | null = reaction?.type || null;

      let isScrapped = false;
      if (currentUserId) {
          const scrap = await this.postsRepo.findUserScrap(id, currentUserId);
          isScrapped = !!scrap;
      }

      return {
          ...post,
          viewCount,
          likeCount,
          dislikeCount,
          commentCount: post.commentCount,
          userReaction,
          isScrapped,
      };
  }
  
  private async hashPassword(password: string): Promise<string> {
      const salt = await bcrypt.genSalt(10);
      return bcrypt.hash(password, salt);
  }

  private async comparePassword(password: string, hash: string): Promise<boolean> {
      return bcrypt.compare(password, hash);
  }

  async create(userId: string | null, boardSlug: string, dto: CreatePostDto, ip?: string, userAgent?: string) {
      const board = await this.boardsService.findBySlug(boardSlug);
      if (!board) throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);

      if (board.isPrivate && !userId) {
          throw new Error('Login required for private board');
      }

      // 익명 작성 권한 확인
      if (!userId && !board.allowAnonymous) {
          throw new Error('이 게시판은 익명 작성을 허용하지 않습니다.');
      }

      const newPostData: any = {
          boardId: board.id,
          userId: userId || null,
          title: dto.title,
          category: dto.category,
          content: sanitizeContent(dto.content),
          guestName: dto.guestName,
          guestPassword: dto.guestPassword ? await this.hashPassword(dto.guestPassword) : null,
          allowComments: dto.allowComments !== undefined ? dto.allowComments : true,
          receiveCommentNotification: dto.receiveCommentNotification !== undefined ? dto.receiveCommentNotification : true,
      };

      if (userId) {
          const currentUser = await this.postsRepo.findUserById(userId);
          if (isAdmin(currentUser?.role as any)) {
              if (dto.isNotice !== undefined) newPostData.isNotice = dto.isNotice;
              if (dto.isPinned !== undefined) newPostData.isPinned = dto.isPinned;
              if (dto.isBest !== undefined) newPostData.isBest = dto.isBest;
          }
      }

      const newPost = await this.postsRepo.createPost(newPostData);
      
      // content 내의 temp 이미지를 영구 폴더로 이동
      const processedContent = await this.uploadsService.moveTempImages(dto.content, `posts/${newPost.id}`);
      if (processedContent !== dto.content) {
          await this.postsRepo.updatePost(newPost.id, { content: processedContent });
          newPost.content = processedContent;
      }

      if (userId) {
          this.eventEmitter.emit(
              'post.created',
              new PostCreatedEvent(
                  userId,
                  newPost.id,
                  newPost.title,
                  board.name,
                  ip,
                  userAgent
              )
          );
      }

      
      return newPost;
  }

  async update(id: string, userId: string | undefined, data: {
      title?: string;
      content?: string;
      guestPassword?: string;
      isPinned?: boolean;
      isNotice?: boolean;
      isBest?: boolean;
      allowComments?: boolean;
      receiveCommentNotification?: boolean;
  }, ip?: string, userAgent?: string) {
      const post = await this.postsRepo.findById(id);

      if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);

      // Authorization Logic
      if (post.userId) {
          if (post.userId !== userId) {
              if (userId) {
                  const currentUser = await this.postsRepo.findUserById(userId);
                  if (!isAdmin(currentUser?.role as any)) {
                      throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
                  }
              } else {
                  throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
              }
          }
      } else {
          const isPasswordValid = data.guestPassword ? await this.comparePassword(data.guestPassword, post.guestPassword || '') : false;
          if (!isPasswordValid) {
              if (userId) {
                  const currentUser = await this.postsRepo.findUserById(userId);
                  if (!isAdmin(currentUser?.role as any)) {
                      throw new ApiException(ErrorCode.POST_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
                  }
              } else {
                  throw new ApiException(ErrorCode.POST_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
              }
          }
      }

      // Update fields
      const updates: any = {
          updatedAt: new Date(),
      };
      if (data.title !== undefined) updates.title = data.title;
      if (data.content !== undefined) {
          const sanitizedContent = sanitizeContent(data.content);
          updates.content = await this.uploadsService.moveTempImages(sanitizedContent, `posts/${id}`);
          
          // 수정한 본문 내용 중 지워진 이미지가 있다면 백그라운드 서버 삭제 트리거
          if (post.content !== null) {
              await this.uploadsService.cleanupOrphanImages(post.content, updates.content, `posts/${id}`);
          }
      }
      
      if (data.allowComments !== undefined) updates.allowComments = data.allowComments;
      if (data.receiveCommentNotification !== undefined) updates.receiveCommentNotification = data.receiveCommentNotification;

      // Admin only fields
      if (userId) {
          const currentUser = await this.postsRepo.findUserById(userId);
          if (isAdmin(currentUser?.role as any)) {
              if (data.isPinned !== undefined) updates.isPinned = data.isPinned;
              if (data.isNotice !== undefined) updates.isNotice = data.isNotice;
              if (data.isBest !== undefined) updates.isBest = data.isBest;
          }
      }

      const updated = await this.postsRepo.updatePost(id, updates);
      
      if (userId && updated) {
          this.eventEmitter.emit(
              'post.updated',
              new PostUpdatedEvent(
                  userId,
                  updated.id,
                  updated.title,
                  ip,
                  userAgent
              )
          );
      }

      return updated;
  }

  async remove(id: string, userId?: string, guestPassword?: string, ip?: string, userAgent?: string) {
      const post = await this.postsRepo.findById(id);

      if (!post) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);

      // Authorization Logic
      if (post.userId) {
          // Logged-in user post
          if (post.userId !== userId) {
             // Check if admin
             if (userId) {
                 const currentUser = await this.postsRepo.findUserById(userId);
                 if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
                    throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
                 }
             } else {
                throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
             }
          }
      } else {
          // Guest post
          const isPasswordValid = guestPassword ? await this.comparePassword(guestPassword, post.guestPassword || '') : false;
          if (!isPasswordValid) {
              // If admin, allow
              if (userId) {
                const currentUser = await this.postsRepo.findUserById(userId);
                if (!isAdmin(currentUser?.role as any)) {
                  throw new ApiException(ErrorCode.POST_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
                }
              } else {
                throw new ApiException(ErrorCode.POST_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
              }
          }
      }

      await this.postsRepo.transaction(async (tx) => {
          // Soft delete post
          await this.postsRepo.softDeletePost(id, tx);
          // Soft delete associated comments
          await this.postsRepo.softDeleteCommentsByPost(id, tx);
      });

      // 게시글 관련 이미지 삭제 (Storage)
      await this.uploadsService.deleteDirectory(`posts/${id}`).catch(err => {
          this.logger.error(`Failed to delete images for post ${id}:`, err);
      });

      if (userId) {
          this.eventEmitter.emit(
              'post.deleted',
              new PostDeletedEvent(
                  userId,
                  post.id,
                  post.title,
                  ip,
                  userAgent
              )
          );
      }

      return { success: true };
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

  async toggleReaction(id: string, userId: string | undefined, type: 'like' | 'dislike', ipAddress?: string, userAgent?: string) {
    let reactionEvent: PostReactionEvent | null = null;

    const result = await this.postsRepo.transaction(async (tx) => {
        const post = await this.postsRepo.findByIdWithDetails(id, tx);
        if (!post) throw new Error('Post not found');

        // Check for existing reaction by userId or ipAddress
        const existing = await this.postsRepo.findUserReaction(id, userId, ipAddress, tx);

        let userReaction: 'like' | 'dislike' | null = null;

        if (existing) {
            if (existing.type === type) {
                await this.postsRepo.deleteReaction(existing.id, tx);
                userReaction = null;
            } else {
                await this.postsRepo.updateReaction(existing.id, type, tx);
                userReaction = type;
            }
        } else {
            await this.postsRepo.createReaction({
                postId: id,
                userId: userId || null,
                ipAddress: userId ? null : ipAddress,
                type,
            }, tx);
            userReaction = type;
        }

        // Fetch counts from transaction
        const reactionCounts = await this.postsRepo.getReactionCountsForPost(id, tx);

        const likeCount = reactionCounts.find(r => r.type === 'like')?.count || 0;
        const dislikeCount = reactionCounts.find(r => r.type === 'dislike')?.count || 0;

        // 베스트 게시글 자동 승격 로직 (예: 추천수 10개 달성 시 isBest = true)
        const BEST_THRESHOLD = 10;
        if (likeCount >= BEST_THRESHOLD && !post.isBest) {
            await this.postsRepo.updatePost(post.id, { isBest: true }, tx);
            this.logger.log(`Post ${post.id} promoted to Best Post!`);
        }

        if (userId && userReaction === 'like') {
            reactionEvent = new PostReactionEvent(
                userId,
                post.id,
                post.title,
                post.userId!,
                (post.board as any).slug,
                userReaction,
                ipAddress,
                userAgent
            );
        }

        return {
            likeCount,
            dislikeCount,
            userReaction,
        };
    });

    if (reactionEvent) {
        this.eventEmitter.emit('post.reaction', reactionEvent);
    }

    return result;
  }

  async toggleScrap(postId: string, userId: string) {
      const existing = await this.postsRepo.findUserScrap(postId, userId);

      if (existing) {
          await this.postsRepo.deleteScrap(existing.id);
          return { isScrapped: false };
      } else {
          await this.postsRepo.createScrap(postId, userId);
          return { isScrapped: true };
      }
  }

  async findScrappedPosts(userId: string, page: number = 1, limit: number = 20) {
      const offset = (page - 1) * limit;

      const items = await this.postsRepo.findScrappedPosts(userId, offset, limit);
      const totalCount = await this.postsRepo.countScrappedPosts(userId);

      return {
          items: items.map(item => ({
              ...item.post,
              message: item.post 
          })).map(item => {
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
