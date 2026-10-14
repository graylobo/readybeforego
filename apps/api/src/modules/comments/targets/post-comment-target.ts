import { ErrorCode, isAdmin, USER_ROLES } from '@community/shared-types';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions/api.exception';
import { BoardManagersService } from '../../boards/board-managers.service';
import { CommentsRepository, Transaction } from '../comments.repository';
import type { CommentViewer } from '../comments.service';
import { CommentTarget, isUuid } from './comment-target';

type PostAccess = Awaited<ReturnType<CommentsRepository['findPostAccess']>>;

/** 게시글 댓글: 글과 같은 기준으로 볼 수 있는 사람만, 게시판·글 설정에 따라 작성 제한, 글에 댓글 수 저장 */
@Injectable()
export class PostCommentTarget implements CommentTarget {
  readonly type = 'post';

  constructor(
    private readonly commentsRepo: CommentsRepository,
    private readonly boardManagers: BoardManagersService,
  ) {}

  isValidId(targetId: string) {
    return isUuid(targetId);
  }

  /**
   * 없거나 삭제된 글은 404, 비공개 게시판 글은 글과 같은 기준으로 작성자/관리자만 허용,
   * 비공개 처리한 글은 Super Admin만 (그 외에는 404)
   */
  private assertCanAccess(postAccess: PostAccess, viewer: CommentViewer): asserts postAccess is NonNullable<PostAccess> {
    if (!postAccess) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (postAccess.hiddenAt && viewer.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (!postAccess.isPrivate) return;
    if (!viewer.userId) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
    if (postAccess.userId !== viewer.userId && !isAdmin(viewer.role as any)) {
      throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
  }

  async assertCanView(targetId: string, viewer: CommentViewer, tx?: Transaction) {
    this.assertCanAccess(await this.commentsRepo.findPostAccess(targetId, tx), viewer);
  }

  async assertCanWrite(targetId: string, viewer: CommentViewer) {
    const postAccess = await this.commentsRepo.findPostAccess(targetId);
    this.assertCanAccess(postAccess, viewer);
    if (postAccess.isReadOnly && !isAdmin(viewer.role as any)) {
      throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, '읽기 전용 게시판이라 새 댓글을 달 수 없습니다.');
    }
    if (postAccess.allowComments === false) {
      throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, '작성자가 댓글 작성을 허용하지 않은 게시글입니다.');
    }
  }

  adjustCommentCount(targetId: string, delta: number, tx: Transaction) {
    return this.commentsRepo.updatePostCommentCount(targetId, delta, tx);
  }

  recountComments(targetId: string, tx: Transaction) {
    return this.commentsRepo.recountPostCommentCount(targetId, tx);
  }

  // 게시판 관리자(매니저·부매니저)는 자기 게시판 글에 달린 댓글을 지울 수 있다
  async canModerate(targetId: string, viewer: CommentViewer) {
    const postAccess = await this.commentsRepo.findPostAccess(targetId);
    return !!postAccess && this.boardManagers.canModerate(postAccess.boardId, viewer);
  }
}
