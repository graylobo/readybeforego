import { ErrorCode } from '@community/shared-types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ApiException } from '../../../common/exceptions/api.exception';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import type { Transaction } from '../comments.repository';
import { CommentTarget, isUuid } from './comment-target';

/** 사기 제보 댓글 (대상 id는 scam_infos.id). 삭제되지 않은 제보에만. 댓글 수는 따로 저장하지 않는다 */
@Injectable()
export class ScamInfoCommentTarget implements CommentTarget {
  readonly type = 'scam_info';

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  isValidId(targetId: string) {
    return isUuid(targetId);
  }

  async assertCanView(targetId: string, _viewer: unknown, tx?: Transaction) {
    const db = tx ?? this.db;
    const [scam] = await db
      .select({ id: schema.scamInfos.id })
      .from(schema.scamInfos)
      .where(and(eq(schema.scamInfos.id, targetId), isNull(schema.scamInfos.deletedAt)))
      .limit(1);
    if (!scam) throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, '제보를 찾을 수 없습니다.');
  }

  assertCanWrite(targetId: string, viewer: unknown) {
    return this.assertCanView(targetId, viewer);
  }
}

/** 국가 가이드 화면의 댓글 (대상 id는 국가 코드 countries.code, 예: JP). 등록된 국가에만 */
@Injectable()
export class CountryGuideCommentTarget implements CommentTarget {
  readonly type = 'country_guide';

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  isValidId(targetId: string) {
    return targetId.length > 0 && targetId.length <= 16;
  }

  async assertCanView(targetId: string, _viewer: unknown, tx?: Transaction) {
    const db = tx ?? this.db;
    const [country] = await db
      .select({ code: schema.countries.code })
      .from(schema.countries)
      .where(eq(schema.countries.code, targetId))
      .limit(1);
    if (!country) throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, '국가를 찾을 수 없습니다.');
  }

  assertCanWrite(targetId: string, viewer: unknown) {
    return this.assertCanView(targetId, viewer);
  }
}
