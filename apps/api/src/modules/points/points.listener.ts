import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PointsService } from './points.service';
import { PostCreatedEvent } from '../posts/events/post-created.event';
import { CommentCreatedEvent } from '../comments/events/comment-created.event';
import { PointActionType } from '@community/shared-types';
import { PointsRevokeEvent } from './events/points-revoke.event';

@Injectable()
export class PointsListener {
  constructor(private readonly pointsService: PointsService) {}

  @OnEvent('post.created')
  async handlePostCreated(event: PostCreatedEvent) {
    await this.pointsService.awardPoints(
      event.userId,
      PointActionType.POST_CREATED,
      event.postId,
      'post',
    );
  }

  @OnEvent('points.revoke')
  async handleRevoke(event: PointsRevokeEvent) {
    await this.pointsService.revokePoints(event.userId, event.actionType, event.relatedId, event.relatedType);
  }

  @OnEvent('comment.created')
  async handleCommentCreated(event: CommentCreatedEvent) {
    if (!event.userId) return; // 비회원 댓글은 포인트 없음
    await this.pointsService.awardPoints(
      event.userId,
      PointActionType.COMMENT_CREATED,
      event.commentId,
      'comment',
    );
  }
}
