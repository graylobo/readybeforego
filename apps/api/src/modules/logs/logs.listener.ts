import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommentDeletedEvent, CommentReactionEvent, CommentUpdatedEvent } from '../comments/events/comment-actions.events';
import { CommentCreatedEvent } from '../comments/events/comment-created.event';
import { PostDeletedEvent, PostReactionEvent, PostUpdatedEvent } from '../posts/events/post-actions.events';
import { PostCreatedEvent } from '../posts/events/post-created.event';
import { LogsService } from './logs.service';

@Injectable()
export class LogsListener {
  constructor(private readonly logsService: LogsService) {}

  @OnEvent('post.created')
  handlePostCreated(event: PostCreatedEvent) {
    this.logsService.create({
      userId: event.userId,
      type: 'POST_CREATE',
      action: `${event.boardName} 게시판에 글 작성: ${event.title}`,
      targetId: event.postId,
      targetType: 'POST',
      ipAddress: event.ip,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('post.updated')
  handlePostUpdated(event: PostUpdatedEvent) {
    this.logsService.create({
      userId: event.userId,
      type: 'UPDATE_PROFILE',
      action: `게시글 수정: ${event.title}`,
      targetId: event.postId,
      targetType: 'POST',
      ipAddress: event.ip,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('post.deleted')
  handlePostDeleted(event: PostDeletedEvent) {
    this.logsService.create({
      userId: event.userId,
      type: 'DELETE_POST',
      action: `게시글 삭제: ${event.title}`,
      targetId: event.postId,
      targetType: 'POST',
      ipAddress: event.ip,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('post.reaction')
  handlePostReaction(event: PostReactionEvent) {
    if (event.userId && event.type === 'like') {
        this.logsService.create({
          userId: event.userId,
          type: 'LIKE',
          action: `게시글 추천: ${event.title}`,
          targetId: event.postId,
          targetType: 'POST',
          ipAddress: event.ip,
          userAgent: event.userAgent,
        });
    }
  }

  @OnEvent('comment.created')
  handleCommentCreated(event: CommentCreatedEvent) {
    this.logsService.create({
      userId: event.userId,
      type: 'COMMENT_CREATE',
      action: `댓글 작성: ${event.content.substring(0, 30)}${event.content.length > 30 ? '...' : ''}`,
      targetId: event.commentId,
      targetType: 'COMMENT',
      ipAddress: event.ip,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('comment.updated')
  handleCommentUpdated(event: CommentUpdatedEvent) {
    this.logsService.create({
      userId: event.userId,
      type: 'UPDATE_PROFILE',
      action: `댓글 수정: ${event.content.substring(0, 30)}...`,
      targetId: event.commentId,
      targetType: 'COMMENT',
      ipAddress: event.ip,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('comment.deleted')
  handleCommentDeleted(event: CommentDeletedEvent) {
    this.logsService.create({
      userId: event.userId,
      type: 'DELETE_POST',
      action: '댓글 삭제',
      targetId: event.commentId,
      targetType: 'COMMENT',
      ipAddress: event.ip,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('comment.reaction')
  handleCommentReaction(event: CommentReactionEvent) {
    if (event.userId && event.type === 'like') {
        this.logsService.create({
          userId: event.userId,
          type: 'LIKE',
          action: `댓글 추천: ${event.content.substring(0, 30)}...`,
          targetId: event.commentId,
          targetType: 'COMMENT',
          ipAddress: event.ip,
          userAgent: event.userAgent,
        });
    }
  }
}
