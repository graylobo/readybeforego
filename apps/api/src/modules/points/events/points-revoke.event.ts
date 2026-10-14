import { PointActionType } from '@community/shared-types';

/**
 * 포인트 회수 요청. 글/댓글이 지워지면 그 글/댓글로 받은 포인트를 되돌린다
 * (지우고 다시 쓰기를 반복해 포인트를 쌓는 것 방지)
 */
export class PointsRevokeEvent {
  constructor(
    public readonly userId: string,
    public readonly actionType: PointActionType,
    public readonly relatedId: string,
    public readonly relatedType: 'post' | 'comment',
  ) {}
}
