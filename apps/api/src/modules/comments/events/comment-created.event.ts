export class CommentCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly commentId: string,
    public readonly targetId: string,
    public readonly targetType: 'post' | 'comment',
    public readonly content: string,
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}
