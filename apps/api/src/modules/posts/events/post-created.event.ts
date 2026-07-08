export class PostCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly postId: string,
    public readonly title: string,
    public readonly boardName: string,
    public readonly ip?: string,
    public readonly userAgent?: string,
  ) {}
}
