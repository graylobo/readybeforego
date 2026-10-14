import { ErrorCode, isAdmin, isSuperAdmin, PointActionType } from '@community/shared-types';
import { HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { ApiException } from '../../common/exceptions/api.exception';
import { omitGuestPassword } from '../../common/utils/omit-guest-password';
import { CommentsRepository } from './comments.repository';
import { CommentDeletedEvent, CommentReactionEvent, CommentUpdatedEvent } from './events/comment-actions.events';
import { CommentCreatedEvent } from './events/comment-created.event';
import { UploadsService } from '../uploads/uploads.service';
import { PointsRevokeEvent } from '../points/events/points-revoke.event';
import { CommentTargetRegistry } from './targets';

const BEST_COMMENT_MIN_UPVOTES = 10;
const BEST_COMMENT_MAX_COUNT = 3;

/** 요청한 사용자. role은 인증 단계에서 읽은 값(req.user.role) */
export interface CommentViewer {
  userId?: string;
  role?: string;
  ipAddress?: string;
}

// 비회원 댓글 작성자 IP는 앞 두 자리만 공개 (예: 123.45)
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const cleaned = ip.replace(/^.*:/, '');
  const parts = cleaned.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : null;
}

type CommentRow = {
  id: string;
  targetId: string;
  targetType: string;
  userId: string | null;
  guestName: string | null;
  ipAddress: string | null;
  parentId: string | null;
  content: string;
  emoticonUrl: string | null;
  imageUrl: string | null;
  likeCount: number;
  dislikeCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { name: string | null; picture: string | null } | null;
};

/** 화면에 보여줄 댓글 형태(CommentTree). 목록 조회와 작성 응답이 같은 형태를 쓰도록 공유 */
export function toCommentTree(comment: CommentRow, myReaction?: string) {
  const isDeleted = !!comment.deletedAt;
  return {
    id: comment.id,
    targetId: comment.targetId,
    targetType: comment.targetType,
    userId: comment.userId,
    guestName: comment.guestName,
    // 회원 댓글은 IP를 내려주지 않고, 비회원 댓글도 앞 두 자리만 공개
    ipAddress: comment.userId ? null : maskIp(comment.ipAddress),
    userName: comment.user?.name ?? null,
    userEmail: null,
    userPicture: comment.user?.picture ?? null,
    parentId: comment.parentId,
    content: isDeleted ? '삭제된 댓글입니다.' : comment.content,
    emoticonUrl: isDeleted ? null : comment.emoticonUrl,
    imageUrl: isDeleted ? null : comment.imageUrl,
    isDeleted,
    upvoteCount: isDeleted ? 0 : comment.likeCount,
    downvoteCount: isDeleted ? 0 : comment.dislikeCount,
    isUpvoted: !isDeleted && myReaction === 'like',
    isDownvoted: !isDeleted && myReaction === 'dislike',
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    replies: [] as any[],
  };
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);
  constructor(
    private readonly commentsRepo: CommentsRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly uploadsService: UploadsService,
    // 대상(게시글 등)마다 다른 규칙은 targets/의 대상 클래스가 맡는다
    private readonly targets: CommentTargetRegistry,
  ) {}

  // 게시글 비회원 비밀번호와 동일하게 bcrypt(salt 포함)로 저장
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 댓글 첨부 이미지는 그 사용자가 올린 댓글 이미지(comments/{사용자 id}/...)만 허용한다.
   * 다른 사람의 파일 주소를 넣은 뒤 댓글을 지워 그 파일을 지우게 하는 것을 막기 위함 (댓글 삭제 시 첨부 이미지를 지움)
   */
  private assertOwnCommentImage(imageUrl: string | null | undefined, ownerIds: (string | null | undefined)[]) {
    if (!imageUrl) return;
    const path = this.uploadsService.extractPathFromUrl(imageUrl);
    const isOwn = !!path && !path.includes('..') && ownerIds.some((id) => !!id && path.startsWith(`comments/${id}/`));
    if (!isOwn) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.BAD_REQUEST, '첨부할 수 없는 이미지입니다.');
    }
  }

  /**
   * 댓글 작성. 화면이 목록을 다시 불러오지 않고 바로 끼워 넣을 수 있도록 목록과 같은 형태(CommentTree)로 돌려준다
   */
  async create(viewer: CommentViewer, dto: any, userAgent?: string) {
    const userId = viewer.userId;
    const ipAddress = viewer.ipAddress;
    const target = this.targets.get(dto.targetType);

    // 대상 확인(있는지, 댓글을 달 수 있는지), 답글 대상, 작성자 정보, 비밀번호 해시는 서로 독립적이라 동시에 처리
    const [, parent, user, guestPasswordHash] = await Promise.all([
      target.assertCanWrite(dto.targetId, viewer),
      dto.parentId ? this.commentsRepo.findById(dto.parentId) : Promise.resolve(undefined),
      userId ? this.commentsRepo.findUserById(userId) : Promise.resolve(undefined),
      dto.guestPassword ? this.hashPassword(dto.guestPassword) : Promise.resolve(null),
    ]);

    // 비회원 댓글은 비밀번호로만 수정/삭제할 수 있으므로 반드시 받는다
    if (!userId && !dto.guestPassword) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.BAD_REQUEST, '비밀번호를 입력해주세요.');
    }
    this.assertOwnCommentImage(dto.imageUrl, [userId]);
    // 답글은 같은 글의 (삭제되지 않은) 댓글에만 달 수 있다
    if (dto.parentId && (!parent || parent.targetType !== dto.targetType || parent.targetId !== dto.targetId)) {
      throw new ApiException(ErrorCode.COMMENT_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    let guestName = dto.guestName;
    if (!userId && !guestName) {
      guestName = maskIp(ipAddress) ?? '익명';
    }

    const { comment, commentCount } = await this.commentsRepo.transaction(async (tx) => {
      const created = await this.commentsRepo.createComment({
          targetId: dto.targetId,
          targetType: dto.targetType,
          userId: userId || null,
          guestName: guestName || null,
          guestPassword: guestPasswordHash,
          ipAddress: ipAddress || null,
          // 댓글은 화면에서 글자로만 그린다(HTML로 그리지 않음). HTML 정화를 하면 &, < 같은 글자가 &amp; 처럼 바뀌어 보이므로 그대로 저장
          content: dto.content ?? '',
          emoticonUrl: dto.emoticonUrl || null,
          imageUrl: dto.imageUrl || null,
          parentId: dto.parentId || null,
      }, tx);
      const count = await target.adjustCommentCount?.(dto.targetId, 1, tx);
      return { comment: created, commentCount: count };
    });

    // 비회원 댓글도 알림(글쓴이/원댓글 작성자)은 가야 하므로 항상 알린다 (포인트·활동 기록은 받는 쪽에서 회원만 처리)
    this.eventEmitter.emit(
      'comment.created',
      new CommentCreatedEvent(
        userId ?? null,
        comment.id,
        dto.targetId,
        dto.targetType,
        comment.content,
        ipAddress,
        userAgent
      )
    );

    return {
      comment: toCommentTree({ ...comment, user: user ?? null } as CommentRow),
      commentCount,
    };
  }

  async getCommentsByTarget(
    targetType: string,
    targetId: string,
    viewer: CommentViewer = {},
    page: number = 1,
    limit: number = 100,
  ) {
    const target = this.targets.get(targetType);
    page = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    limit = Number.isFinite(limit) && limit >= 1 ? Math.min(Math.floor(limit), 200) : 100;

    // 댓글, 내 반응, 대상 접근 권한을 동시에 조회. 추천 수는 댓글에 저장된 값을 사용
    const [allComments, myReactions] = await Promise.all([
      this.commentsRepo.findCommentsByTarget(targetType, targetId),
      this.commentsRepo.findUserReactionsByTarget(targetType, targetId, viewer.userId, viewer.ipAddress),
      target.assertCanView(targetId, viewer),
    ]);

    if (allComments.length === 0) {
      return {
        comments: [],
        bestComments: [],
        total: 0,
        pagination: { page, limit, totalRootCount: 0, totalPages: 0 },
      };
    }

    const myReactionMap = new Map(myReactions.map((r) => [r.commentId, r.type]));

    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];
    const allMappedComments: any[] = [];

    for (const comment of allComments) {
      const commentTree = toCommentTree(comment as CommentRow, myReactionMap.get(comment.id) as string | undefined);
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


  /**
   * 수정/삭제 권한 확인. 회원 댓글은 작성자 또는 관리자, 비회원 댓글은 비밀번호 일치 또는 관리자
   */
  private async assertCanModify(
    comment: { userId: string | null; guestPassword: string | null },
    viewer: CommentViewer,
    guestPassword?: string,
  ) {
    const viewerIsAdmin = !!viewer.userId && isAdmin(viewer.role as any);
    if (comment.userId) {
        if (comment.userId === viewer.userId || viewerIsAdmin) return;
        if (!viewer.userId) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
        throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    if (viewerIsAdmin) return;
    if (!guestPassword) throw new ApiException(ErrorCode.COMMENT_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
    const isPasswordValid = await this.comparePassword(guestPassword, comment.guestPassword || '');
    if (!isPasswordValid) throw new ApiException(ErrorCode.COMMENT_INVALID_PASSWORD, HttpStatus.FORBIDDEN);
  }

  async update(id: string, viewer: CommentViewer, dto: { content?: string; emoticonUrl?: string | null; imageUrl?: string | null; guestPassword?: string }, userAgent?: string) {
    const comment = await this.commentsRepo.findById(id);

    if (!comment) throw new ApiException(ErrorCode.COMMENT_NOT_FOUND, HttpStatus.NOT_FOUND);

    await this.assertCanModify(comment, viewer, dto.guestPassword);
    const userId = viewer.userId;
    const ip = viewer.ipAddress;
    // 관리자가 남의 댓글을 고칠 때는 작성자 또는 관리자 본인이 올린 이미지를 허용
    if (dto.imageUrl && dto.imageUrl !== comment.imageUrl) {
      this.assertOwnCommentImage(dto.imageUrl, [comment.userId, userId]);
    }

    const updated = await this.commentsRepo.updateComment(id, {
        ...(dto.content !== undefined && { content: dto.content }),
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

    return omitGuestPassword(updated);
  }

  async remove(
    id: string,
    viewer: CommentViewer,
    guestPassword?: string,
    deleteMode: 'soft' | 'hard' = 'soft',
    userAgent?: string
  ) {
    // 완전 삭제(DB에서 지움, 답글까지 함께)는 Super Admin만. 이미 삭제된 댓글('삭제된 댓글입니다'로 남은 것)도 지울 수 있다
    if (deleteMode === 'hard' && !(viewer.userId && isSuperAdmin(viewer.role as any))) {
      throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const comment =
      deleteMode === 'hard'
        ? await this.commentsRepo.findByIdIncludingDeleted(id)
        : await this.commentsRepo.findById(id);

    if (!comment) throw new ApiException(ErrorCode.COMMENT_NOT_FOUND, HttpStatus.NOT_FOUND);

    // 대상별 관리자(예: 게시판 매니저·부매니저)는 작성자가 아니어도 지울 수 있다
    const target = this.targets.find(comment.targetType);
    const isModerator = (await target?.canModerate?.(comment.targetId, viewer)) ?? false;
    if (!isModerator) await this.assertCanModify(comment, viewer, guestPassword);
    const userId = viewer.userId;
    const ip = viewer.ipAddress;

    // 완전 삭제는 답글까지 지워지므로 답글 이미지·포인트도 함께 정리한다 (지우기 전에 모아 둔다)
    const removed =
      deleteMode === 'hard'
        ? await this.commentsRepo.findThread(id)
        : [{ id: comment.id, userId: comment.userId, imageUrl: comment.imageUrl, isDeleted: false }];
    const imageUrls = removed.map((c) => c.imageUrl).filter((url): url is string => !!url);
    let softDeleted = false;

    const result = await this.commentsRepo.transaction(async (tx) => {
        // 대상에 저장된 댓글 수 갱신. 완전 삭제는 답글까지 함께 지워지므로(onDelete cascade) 남은 댓글을 다시 센다
        let commentCount: number | undefined;
        if (deleteMode === 'hard') {
            await this.commentsRepo.hardDeleteComment(id, tx);
            commentCount = await target?.recountComments?.(comment.targetId, tx);
        } else {
            const changed = await this.commentsRepo.softDeleteComment(id, tx);
            softDeleted = changed;
            if (changed) {
                commentCount = await target?.adjustCommentCount?.(comment.targetId, -1, tx);
            }
        }

        return { success: true, commentCount };

    });

    // 지워진 댓글로 받은 포인트를 되돌린다 (이미 지워져 있던 답글은 그때 회수됨, 동시에 두 번 지우면 한 번만)
    if (deleteMode === 'hard' || softDeleted) {
      for (const c of removed) {
        if (c.userId && !c.isDeleted) {
          this.eventEmitter.emit('points.revoke', new PointsRevokeEvent(c.userId, PointActionType.COMMENT_CREATED, c.id, 'comment'));
        }
      }
    }

    // 댓글 삭제 완료 후, 업로드된 이미지가 있으면 스토리지에서 삭제 (트랜잭션 차단 방지)
    for (const imageUrl of new Set(imageUrls)) {
      try {
        const imagePath = this.uploadsService.extractCommentImagePath(imageUrl);
        if (imagePath) {
          await this.uploadsService.deleteImage(imagePath);
          this.logger.log(`Successfully deleted comment image from storage: ${imageUrl}`);
        }
      } catch (err) {
        this.logger.error(`Failed to delete comment image from storage: ${imageUrl}`, err);
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

  /**
   * 댓글 추천/비추천 토글. 댓글에 저장된 추천 수를 변화량만큼만 갱신한다
   */
  async toggleReaction(id: string, viewer: CommentViewer, type: 'like' | 'dislike', userAgent?: string) {
    const { userId, ipAddress } = viewer;
    if (!userId && !ipAddress) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
    let reactionEvent: CommentReactionEvent | null = null;

    const result = await this.commentsRepo.transaction(async (tx) => {
        const comment = await this.commentsRepo.findById(id, tx);
        if (!comment) throw new ApiException(ErrorCode.COMMENT_NOT_FOUND, HttpStatus.NOT_FOUND);
        // 볼 수 없는 대상(삭제된 글, 비공개 게시판 글 등)의 댓글에는 반응할 수 없다
        await this.targets.find(comment.targetType)?.assertCanView(comment.targetId, viewer, tx);

        const existing = await this.commentsRepo.findUserReaction(id, userId, ipAddress, tx);
        const delta = { like: 0, dislike: 0 };
        let userReaction: 'like' | 'dislike' | null;
        let message: string;

        // 동시에 같은 요청이 와도 실제로 바뀐 행이 있을 때만 수치를 바꾼다
        if (existing && existing.type === type) {
            if (await this.commentsRepo.deleteReaction(existing.id, tx)) delta[type] -= 1;
            userReaction = null;
            message = 'Reaction removed';
        } else if (existing) {
            if (await this.commentsRepo.updateReaction(existing.id, existing.type, type, tx)) {
                delta[existing.type] -= 1;
                delta[type] += 1;
            }
            userReaction = type;
            message = 'Reaction updated';
        } else {
            const inserted = await this.commentsRepo.createReaction({
                commentId: id,
                userId: userId || null,
                ipAddress: !userId ? ipAddress : null,
                type,
            }, tx);
            if (inserted) delta[type] += 1;
            userReaction = type;
            message = 'Reaction added';

            if (inserted && userId && type === 'like' && comment.userId) {
                reactionEvent = new CommentReactionEvent(
                    userId,
                    id,
                    comment.content,
                    comment.userId,
                    type,
                    ipAddress,
                    userAgent
                );
            }
        }

        const counts = await this.commentsRepo.applyReactionDelta(id, delta.like, delta.dislike, tx);
        return {
            message,
            userReaction,
            upvoteCount: counts.likeCount,
            downvoteCount: counts.dislikeCount,
        };
    });

    if (reactionEvent) {
        this.eventEmitter.emit('comment.reaction', reactionEvent);
    }

    return result;
  }

  async findByUser(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    
    const [items, totalCount] = await Promise.all([
      this.commentsRepo.findCommentsByUserWithPostDetails(userId, offset, limit),
      this.commentsRepo.countCommentsByUser(userId),
    ]);

    return {
      items,
      total: totalCount || 0,
    };
  }
}
