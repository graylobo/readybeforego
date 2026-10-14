import { ErrorCode } from '@community/shared-types';
import { HttpStatus, Inject, Injectable, Provider, Type } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions/api.exception';
import type { Transaction } from '../comments.repository';
import type { CommentViewer } from '../comments.service';

/**
 * 댓글을 달 수 있는 대상 한 종류 (게시글, 영화, 상영관 …).
 * 댓글 테이블은 target_type + target_id로 어떤 대상이든 담을 수 있고, 대상마다 다른 규칙(대상이 있는지, 누가 볼 수 있는지,
 * 댓글 수를 어디에 저장하는지)은 이 인터페이스를 구현한 클래스가 맡는다. CommentsService는 대상 종류를 모른다.
 *
 * 새 대상 추가: 이 인터페이스를 구현한 @Injectable 클래스를 만들고 targets/index.ts의 COMMENT_TARGET_CLASSES에 넣는다.
 */
export interface CommentTarget {
  /** 댓글 테이블 target_type 값 (화면의 <Comments targetType>과 같은 값) */
  readonly type: string;

  /** 대상 id 형식이 맞는지 (예: 게시글은 UUID). 틀리면 404 */
  isValidId(targetId: string): boolean;

  /** 댓글을 볼 수 있는지 확인 (목록 조회, 추천). 대상이 없거나 볼 수 없으면 예외를 던진다 */
  assertCanView(targetId: string, viewer: CommentViewer, tx?: Transaction): Promise<void>;

  /** 새 댓글을 달 수 있는지 확인 (볼 수 있는지도 함께 확인한다). 대상이 없거나 막혀 있으면 예외를 던진다 */
  assertCanWrite(targetId: string, viewer: CommentViewer): Promise<void>;

  /** 대상에 댓글 수를 저장한다면 변화량만큼 바꾸고 새 수를 돌려준다. 저장하지 않으면 구현하지 않는다 */
  adjustCommentCount?(targetId: string, delta: number, tx: Transaction): Promise<number | undefined>;

  /** 답글까지 함께 지워졌을 때 남은 댓글로 댓글 수를 다시 센다 (adjustCommentCount를 구현했다면 함께 구현) */
  recountComments?(targetId: string, tx: Transaction): Promise<number | undefined>;

  /** 작성자가 아니어도 이 대상의 댓글을 지울 수 있는 사람인지 (예: 게시판 매니저). 구현하지 않으면 작성자·관리자만 */
  canModerate?(targetId: string, viewer: CommentViewer): Promise<boolean>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** id가 UUID 형식인지 (isValidId 구현용) */
export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export const COMMENT_TARGETS = Symbol('COMMENT_TARGETS');

/** 등록된 댓글 대상을 종류 이름으로 찾는다 */
@Injectable()
export class CommentTargetRegistry {
  private readonly targets: Map<string, CommentTarget>;

  constructor(@Inject(COMMENT_TARGETS) targets: CommentTarget[]) {
    this.targets = new Map(targets.map((target) => [target.type, target]));
  }

  /** 등록되지 않은 종류면 400 */
  get(type: string): CommentTarget {
    const target = this.targets.get(type);
    if (!target) throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.BAD_REQUEST);
    return target;
  }

  /** 이미 저장된 댓글의 대상 (등록 목록에서 빠진 종류의 옛 댓글이면 undefined) */
  find(type: string): CommentTarget | undefined {
    return this.targets.get(type);
  }

  /** 요청한 대상 종류와 id 형식 확인. 모르는 종류는 400, 형식이 틀린 id는 404 */
  assertValidTarget(type: string, targetId: string | undefined): CommentTarget {
    const target = this.get(type);
    if (!targetId || !target.isValidId(targetId)) {
      throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return target;
  }
}

/** 댓글 대상 클래스들과 등록소를 Nest provider로 묶는다 (모듈과 테스트에서 같이 쓴다) */
export function commentTargetProviders(targetClasses: Type<CommentTarget>[]): Provider[] {
  return [
    ...targetClasses,
    { provide: COMMENT_TARGETS, useFactory: (...targets: CommentTarget[]) => targets, inject: targetClasses },
    CommentTargetRegistry,
  ];
}
