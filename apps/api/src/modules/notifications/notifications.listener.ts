import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { CommentsRepository } from '../comments/comments.repository';
import { CommentReactionEvent } from '../comments/events/comment-actions.events';
import { CommentCreatedEvent } from '../comments/events/comment-created.event';
import { BoardRequestReviewedEvent } from '../boards/events/board-request-reviewed.event';
import { PostReactionEvent } from '../posts/events/post-actions.events';
import { PostsRepository } from '../posts/posts.repository';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly postsRepo: PostsRepository,
    private readonly commentsRepo: CommentsRepository,
  ) {}

  @OnEvent('post.reaction')
  async handlePostReaction(event: PostReactionEvent) {
    if (event.authorId && event.authorId !== event.userId && event.type === 'like') {
      await this.notificationsService.create({
        userId: event.authorId,
        actorId: event.userId!,
        type: 'LIKE',
        content: `내 글 [${event.title}]이 추천을 받았습니다!`,
        targetId: event.postId,
        targetType: 'POST',
        link: `/board/${event.boardSlug}/${event.postId}`,
      }).catch(e => console.error('Notification error:', e));
    }
  }

  @OnEvent('comment.created')
  async handleCommentCreated(event: CommentCreatedEvent) {
    const notifiedUserIds = new Set<string>();

    const comment = await this.commentsRepo.findById(event.commentId);

    if (comment?.parentId) {
        const parentComment = await this.commentsRepo.findById(comment.parentId);

        if (parentComment && parentComment.userId && parentComment.userId !== event.userId) {
            let replyLink: string | undefined = undefined;
            if (parentComment.targetType === 'post') {
              const post = await this.postsRepo.findByIdWithDetails(parentComment.targetId);
              if (post) {
                const boardSlug = (post as any).board?.slug;
                replyLink = `/board/${boardSlug}/${post.id}?commentId=${event.commentId}#comment-${event.commentId}`;
              }
            }

            await this.notificationsService.create({
              userId: parentComment.userId,
              actorId: event.userId ?? undefined,
              type: 'REPLY',
              content: `내 댓글에 새로운 답글이 달렸습니다: "${parentComment.content.substring(0, 20)}..."`,
              targetId: event.commentId,
              targetType: 'COMMENT',
              link: replyLink,
            });
            notifiedUserIds.add(parentComment.userId);
        }
    }

    if (event.targetType === 'post') {
        const post = await this.postsRepo.findByIdWithDetails(event.targetId);

        if (post && post.userId && post.userId !== event.userId && !notifiedUserIds.has(post.userId)) {
            const notifyOnAllReplies = false;
            const isTopLevelComment = !comment?.parentId;

            if (notifyOnAllReplies || isTopLevelComment) {
                if (post.receiveCommentNotification !== false) {
                    const boardSlug = (post as any).board?.slug;
                    const isInquiry = boardSlug === 'inquiry';
                    const content = isInquiry 
                      ? `내 문의 [${post.title}]에 답변이 등록되었습니다.`
                      : `내 글 [${post.title}]에 새로운 댓글이 달렸습니다.`;

                    await this.notificationsService.create({
                      userId: post.userId,
                      actorId: event.userId ?? undefined,
                      type: 'COMMENT',
                      content,
                      targetId: post.id,
                      targetType: 'POST',
                      link: `/board/${boardSlug}/${post.id}?commentId=${event.commentId}#comment-${event.commentId}`,
                    });
                }
            }
        }
    }
  }

  @OnEvent('board.request.reviewed')
  async handleBoardRequestReviewed(event: BoardRequestReviewedEvent) {
    const approved = event.status === 'approved';
    await this.notificationsService.create({
      userId: event.requesterId,
      actorId: event.reviewerId,
      type: 'SYSTEM',
      content: approved
        ? `신청하신 [${event.boardName}] 게시판이 개설되었습니다. 매니저로 게시판을 관리할 수 있습니다.`
        : `신청하신 [${event.boardName}] 게시판 개설이 반려되었습니다.${event.rejectReason ? ` (사유: ${event.rejectReason})` : ''}`,
      targetId: event.requestId,
      link: approved && event.boardSlug ? `/board/${event.boardSlug}` : '/boards',
    });
  }

    @OnEvent('comment.reaction')
  async handleCommentReaction(event: CommentReactionEvent) {
    if (event.authorId && event.authorId !== event.userId && event.type === 'like') {
        const comment = await this.commentsRepo.findById(event.commentId);

        let link: string | undefined = undefined;
        if (comment && comment.targetType === 'post') {
            const post = await this.postsRepo.findByIdWithDetails(comment.targetId);
            if (post) {
                const boardSlug = (post as any).board?.slug;
                link = `/board/${boardSlug}/${post.id}?commentId=${event.commentId}#comment-${event.commentId}`;
            }
        }

        await this.notificationsService.create({
            userId: event.authorId,
            actorId: event.userId!,
            type: 'LIKE',
            content: `내 댓글 ["${event.content.substring(0, 20)}..."]이 추천을 받았습니다!`,
            targetId: event.commentId,
            targetType: 'COMMENT',
            link,
        }).catch(e => console.error('Notification error:', e));
    }
  }
}
