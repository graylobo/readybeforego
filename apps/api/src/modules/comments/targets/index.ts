import type { Type } from '@nestjs/common';
import type { CommentTarget } from './comment-target';
import { CountryGuideCommentTarget, ScamInfoCommentTarget } from './travel-comment-targets';
import { PostCommentTarget } from './post-comment-target';

/**
 * 댓글을 달 수 있는 대상 목록. 여기에 없는 target_type으로는 댓글을 달거나 볼 수 없다 (400).
 * 파생 프로젝트는 CommentTarget을 구현한 클래스(예: movie-comment-target.ts)를 이 폴더에 만들고 여기에 추가한다.
 */
// 레디비포고: 사기 제보, 국가 가이드의 댓글
export const COMMENT_TARGET_CLASSES: Type<CommentTarget>[] = [PostCommentTarget, ScamInfoCommentTarget, CountryGuideCommentTarget];

export * from './comment-target';
export { PostCommentTarget } from './post-comment-target';
