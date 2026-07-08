export class CommentUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly commentId: string,
    public readonly content: string,
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}

export class CommentDeletedEvent {
  constructor(
    public readonly userId: string,
    public readonly commentId: string,
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}

export class CommentReactionEvent {
  constructor(
    public readonly userId: string | undefined,
    public readonly commentId: string,
    public readonly content: string,
    public readonly authorId: string | null,
    public readonly type: 'like' | 'dislike',
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}
