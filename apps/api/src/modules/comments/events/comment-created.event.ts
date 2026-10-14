export class CommentCreatedEvent {
  constructor(
    /** 비회원 댓글이면 null (알림은 보내고, 포인트·활동 기록은 남기지 않음) */
    public readonly userId: string | null,
    public readonly commentId: string,
    public readonly targetId: string,
    public readonly targetType: 'post' | 'comment',
    public readonly content: string,
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}
