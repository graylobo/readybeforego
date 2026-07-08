export class PostUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly postId: string,
    public readonly title: string,
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}

export class PostDeletedEvent {
  constructor(
    public readonly userId: string,
    public readonly postId: string,
    public readonly title: string,
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}

export class PostReactionEvent {
  constructor(
    public readonly userId: string | undefined,
    public readonly postId: string,
    public readonly title: string,
    public readonly authorId: string | null,
    public readonly boardSlug: string,
    public readonly type: 'like' | 'dislike',
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}
