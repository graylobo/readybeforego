import { ErrorCode, isAdmin } from '@community/shared-types';
import { HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { ApiException } from '../../common/exceptions/api.exception';
import { sanitizeContent } from '../../common/utils/html-sanitizer';
import { CommentsRepository } from './comments.repository';
import { CommentDeletedEvent, CommentReactionEvent, CommentUpdatedEvent } from './events/comment-actions.events';
import { CommentCreatedEvent } from './events/comment-created.event';
import { UploadsService } from '../uploads/uploads.service';

const BEST_COMMENT_MIN_UPVOTES = 10;
const BEST_COMMENT_MAX_COUNT = 3;

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);
  constructor(
    private readonly commentsRepo: CommentsRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly uploadsService: UploadsService,
  ) {}

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  private comparePassword(password: string, hash: string): boolean {
    const hashed = this.hashPassword(password);
    return hashed === hash;
  }

  async create(userId: string | undefined, dto: any, ipAddress?: string, userAgent?: string) {
    const guestPasswordHash = dto.guestPassword 
      ? this.hashPassword(dto.guestPassword) 
      : null;

    let guestName = dto.guestName;
    if (!userId && !guestName && ipAddress) {
      const cleanedIp = ipAddress.replace(/^.*:/, '');
      const parts = cleanedIp.split('.');
      if (parts.length >= 2) {
        guestName = `${parts[0]}.${parts[1]}`;
      } else {
        guestName = '익명';
      }
    }

    const emoticonUrl = dto.emoticonUrl || null;
    const imageUrl = dto.imageUrl || null;

    if (dto.targetType === 'post') {
      const postSettings = await this.commentsRepo.getPostSettings(dto.targetId);
      if (postSettings && postSettings.allowComments === false) {
        throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, '작성자가 댓글 작성을 허용하지 않은 게시글입니다.');
      }
    }

    const result = await this.commentsRepo.transaction(async (tx) => {
      const comment = await this.commentsRepo.createComment({
          targetId: dto.targetId,
          targetType: dto.targetType,
          userId: userId || null,
          guestName: guestName || null,
          guestPassword: guestPasswordHash,
          ipAddress: ipAddress || null,
          content: dto.content ? sanitizeContent(dto.content) : '',
          emoticonUrl: emoticonUrl || null,
          imageUrl: imageUrl || null,
          parentId: dto.parentId || null,
      }, tx);

      let commentCount: number | undefined;
      if (dto.targetType === 'post') {
        commentCount = await this.commentsRepo.updatePostCommentCount(dto.targetId, 1, tx);
      }

      let user: { id: string; name: string; picture: string | null } | null = null;
        if (userId) {
          user = await this.commentsRepo.findUserById(userId, tx) || null;
        }
        
      return {
        ...comment,
        user,
        commentCount
      };
    });

    if (userId) {
      this.eventEmitter.emit(
        'comment.created',
        new CommentCreatedEvent(
          userId as string,
          result.id,
          dto.targetId,
          dto.targetType,
          result.content,
          ipAddress,
          userAgent
        )
      );
    }

    return result;
  }

  async getCommentsByTarget(
    targetType: any,
    targetId: string,
    currentUserId?: string,
    currentIp?: string,
    page: number = 1,
    limit: number = 100,
  ) {
    const allComments = await this.commentsRepo.findCommentsByTarget(
      targetType,
      targetId,
    );

    if (allComments.length === 0) {
      return { comments: [], bestComments: [] };
    }

    // 1) DB에서 해당 타겟 글에 속한 모든 댓글의 추천/비추천 수를 한 번에 집계합니다. (inArray 제거)
    const counts = await this.commentsRepo.countCommentReactionsByTarget(targetType, targetId);
    const commentActionCounts: Record<string, { upvoteCount: number; downvoteCount: number }> = {};
    for (const count of counts) {
      commentActionCounts[count.commentId] = {
        upvoteCount: Number(count.upvoteCount) || 0,
        downvoteCount: Number(count.downvoteCount) || 0,
      };
    }

    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];
    const allMappedComments: any[] = [];

    for (const comment of allComments) {
      const counts = commentActionCounts[comment.id] || {
        upvoteCount: 0,
        downvoteCount: 0,
      };

      const commentTree = {
        id: comment.id,
        targetId: comment.targetId,
        targetType: comment.targetType,
        userId: comment.userId,
        guestName: comment.guestName,
        ipAddress: comment.ipAddress,
        userName: comment.user?.name,
        userEmail: comment.user?.email,
        userPicture: comment.user?.picture,
        parentId: comment.parentId,
        content: comment.deletedAt ? '삭제된 댓글입니다.' : comment.content,
        emoticonUrl: comment.deletedAt ? null : (comment as any).emoticonUrl,
        imageUrl: comment.deletedAt ? null : (comment as any).imageUrl,
        isDeleted: !!comment.deletedAt,
        upvoteCount: comment.deletedAt ? 0 : counts.upvoteCount,
        downvoteCount: comment.deletedAt ? 0 : counts.downvoteCount,
        isUpvoted: false, // 2) 지연 바인딩을 위해 임시 false 설정
        isDownvoted: false, // 2) 지연 바인딩을 위해 임시 false 설정
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        replies: [],
      };

      commentMap.set(comment.id, commentTree);
      allMappedComments.push(commentTree);
    }

    for (const comment of commentMap.values()) {
      if (comment.parentId === null) {
        rootComments.push(comment);
      } else {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        } else {
          // Orphaned reply, treat as root? or ignore.
          // Usually root.
          rootComments.push(comment);
        }
      }
    }

    // Sort replies
    const sortReplies = (comment: any) => {
      comment.replies.sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      comment.replies.forEach(sortReplies);
    };
    rootComments.forEach(sortReplies);

    const bestComments = allMappedComments
      .filter((c) => c.upvoteCount >= BEST_COMMENT_MIN_UPVOTES)
      .sort((a, b) => {
        if (b.upvoteCount !== a.upvoteCount)
          return b.upvoteCount - a.upvoteCount;
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      })
      .slice(0, BEST_COMMENT_MAX_COUNT)
      .map((c) => {
        // Find which root comment this belongs to
        let rootParentId = c.id;
        let current = commentMap.get(c.id);
        while (current && current.parentId !== null) {
          rootParentId = current.parentId;
          current = commentMap.get(rootParentId);
        }
        const rootIndex = rootComments.findIndex(
          (rc) => rc.id === rootParentId,
        );
        const originalPage = Math.floor(rootIndex / limit) + 1;
        return { ...c, originalPage };
      });

    const totalRootCount = rootComments.length;
    const totalPages = Math.ceil(totalRootCount / limit);
    const paginatedRootComments = rootComments.slice(
      (page - 1) * limit,
      page * limit,
    );

    // 3) 실제 노출할 타겟 댓글들의 ID만 선별 수집
    const visibleCommentIds: string[] = [];
    bestComments.forEach((c) => visibleCommentIds.push(c.id));
    
    const collectIds = (comment: any) => {
      visibleCommentIds.push(comment.id);
      comment.replies.forEach(collectIds);
    };
    paginatedRootComments.forEach(collectIds);

    const uniqueVisibleCommentIds = Array.from(new Set(visibleCommentIds));

    // 4) 실제로 화면에 보이는 소수의 댓글(30~50개)에 대해서만 현재 유저의 반응(좋아요 여부) 조회
    const commentActions = await this.getCommentActions(
      uniqueVisibleCommentIds,
      currentUserId,
      currentIp,
    );

    // 5) 유저 반응 데이터 바인딩
    const bindActions = (comment: any) => {
      const action = commentActions[comment.id] || { isUpvoted: false, isDownvoted: false };
      comment.isUpvoted = action.isUpvoted;
      comment.isDownvoted = action.isDownvoted;
      comment.replies.forEach(bindActions);
    };
    
    paginatedRootComments.forEach(bindActions);
    bestComments.forEach((bc) => {
      const action = commentActions[bc.id] || { isUpvoted: false, isDownvoted: false };
      bc.isUpvoted = action.isUpvoted;
      bc.isDownvoted = action.isDownvoted;
    });

    return {
      comments: paginatedRootComments,
      bestComments,
      total: allComments.filter((c) => !c.deletedAt).length,
      pagination: {
        page,
        limit,
        totalRootCount,
        totalPages,
      },
    };
  }


  async getCommentActions(commentIds: string[], userId?: string, ipAddress?: string) {
    if (commentIds.length === 0) return {};
    if (!userId && !ipAddress) return {};

    const actions = await this.commentsRepo.findCommentReactions(commentIds, userId, ipAddress);

    const result: Record<string, { isUpvoted: boolean; isDownvoted: boolean }> = {};
    for (const action of actions) {
      result[action.commentId] = {
        isUpvoted: action.type === 'like',
        isDownvoted: action.type === 'dislike',
      };
    }
    return result;
  }

  async getCommentActionCounts(commentIds: string[]) {
    if (commentIds.length === 0) return {};

    const counts = await this.commentsRepo.countCommentReactions(commentIds);

    const result: Record<string, { upvoteCount: number; downvoteCount: number }> = {};
    
    for (const count of counts) {
        result[count.commentId] = {
            upvoteCount: Number(count.upvoteCount) || 0,
            downvoteCount: Number(count.downvoteCount) || 0,
        };
    }
    return result;
  }

  async update(id: string, userId: string | undefined, dto: { content?: string; emoticonUrl?: string | null; imageUrl?: string | null; guestPassword?: string }, ip?: string, userAgent?: string) {
    const comment = await this.commentsRepo.findById(id);

    if (!comment) throw new ApiException(ErrorCode.COMMENT_NOT_FOUND, HttpStatus.NOT_FOUND);

    if (comment.userId) {
        if (comment.userId !== userId && !isAdmin(userId as any)) throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    } else {
        if (!dto.guestPassword) throw new ApiException(ErrorCode.COMMENT_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
        const isPasswordValid = await this.comparePassword(dto.guestPassword, comment.guestPassword || '');
        if (!isPasswordValid) throw new ApiException(ErrorCode.COMMENT_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
    }

    const updated = await this.commentsRepo.updateComment(id, {
        ...(dto.content !== undefined && { content: sanitizeContent(dto.content) }),
        ...(dto.emoticonUrl !== undefined && { emoticonUrl: dto.emoticonUrl }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        updatedAt: new Date(),
    });

    
    if (userId && updated) {
        this.eventEmitter.emit(
            'comment.updated',
            new CommentUpdatedEvent(
                userId,
                updated.id,
                updated.content,
                ip,
                userAgent
            )
        );
    }

    return updated;
  }

  async remove(id: string, userId: string | undefined, guestPassword?: string, ip?: string, userAgent?: string) {
    const comment = await this.commentsRepo.findById(id);

    if (!comment) throw new ApiException(ErrorCode.COMMENT_NOT_FOUND, HttpStatus.NOT_FOUND);

    if (comment.userId) {
        if (comment.userId !== userId && !isAdmin(userId as any)) throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    } else {
        if (!guestPassword) throw new ApiException(ErrorCode.COMMENT_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
        const isPasswordValid = await this.comparePassword(guestPassword, comment.guestPassword || '');
        if (!isPasswordValid && !isAdmin(userId as any)) throw new ApiException(ErrorCode.COMMENT_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
    }

    const result = await this.commentsRepo.transaction(async (tx) => {
        await this.commentsRepo.softDeleteComment(id, tx);

        // Update Post commentCount if target is post
        let commentCount: number | undefined;
        if (comment.targetType === 'post') {
            commentCount = await this.commentsRepo.updatePostCommentCount(comment.targetId, -1, tx);
        }

        return { success: true, commentCount };

    });

    // 댓글 삭제 완료 후, 업로드된 이미지가 있으면 스토리지에서 비동기 삭제 (트랜잭션 차단 방지)
    if (comment.imageUrl) {
      try {
        const imagePath = this.uploadsService.extractPathFromUrl(comment.imageUrl);
        if (imagePath) {
          await this.uploadsService.deleteImage(imagePath);
          this.logger.log(`Successfully deleted comment image from storage: ${comment.imageUrl}`);
        }
      } catch (err) {
        this.logger.error(`Failed to delete comment image from storage: ${comment.imageUrl}`, err);
      }
    }

    if (userId) {
        this.eventEmitter.emit(
            'comment.deleted',
            new CommentDeletedEvent(
                userId,
                id,
                ip,
                userAgent
            )
        );
    }

    return result;
  }

  async toggleReaction(id: string, userId: string | undefined, type: 'like' | 'dislike', ipAddress?: string, userAgent?: string) {
    let reactionEvent: CommentReactionEvent | null = null;

    const result = await this.commentsRepo.transaction(async (tx) => {
        const comment = await this.commentsRepo.findById(id, tx);
        if (!comment) throw new NotFoundException('Comment not found');

        const existing = await this.commentsRepo.findUserReaction(id, userId, ipAddress, tx);

        if (existing) {
            if (existing.type === type) {
                await this.commentsRepo.deleteReaction(existing.id, tx);
                return { message: 'Reaction removed' };
            } else {
                await this.commentsRepo.updateReaction(existing.id, type, tx);
                return { message: 'Reaction updated' };
            }
        } else {
            await this.commentsRepo.createReaction({
                commentId: id,
                userId: userId || null,
                ipAddress: !userId ? ipAddress : null,
                type,
            }, tx);

            if (userId && type === 'like') {
                reactionEvent = new CommentReactionEvent(
                    userId,
                    id,
                    comment.content,
                    comment.userId!,
                    type,
                    ipAddress,
                    userAgent
                );
            }

            return { message: 'Reaction added' };
        }
    });

    if (reactionEvent) {
        this.eventEmitter.emit('comment.reaction', reactionEvent);
    }

    return result;
  }

  async findByUser(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    
    const items = await this.commentsRepo.findCommentsByUserWithPostDetails(userId, offset, limit);
    const totalCount = await this.commentsRepo.countCommentsByUser(userId);

    return {
      items,
      total: totalCount || 0,
    };
  }
}
