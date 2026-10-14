/** 게시판 개설 신청이 처리됨 (신청자에게 알림) */
export class BoardRequestReviewedEvent {
  constructor(
    public readonly requesterId: string,
    public readonly reviewerId: string,
    public readonly requestId: string,
    public readonly boardName: string,
    public readonly status: 'approved' | 'rejected',
    public readonly boardSlug?: string,
    public readonly rejectReason?: string | null,
  ) {}
}
