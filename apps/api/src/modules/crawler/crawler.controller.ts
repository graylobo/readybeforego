import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { and, eq, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { USER_ROLES } from '@community/shared-types';
import * as schema from '../../database/schema';
import { toCrawlDirection, toPostOrderMode } from './utils/post-timing';
import { normalizeIntervalRange, pickNextCrawlAt } from './utils/crawl-schedule';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CrawlerService } from './services/crawler.service';
import { CrawlerRunControl } from './services/crawler-run-control.service';
import { CrawlerSettingsRepository } from './crawler-settings.repository';

@ApiTags('crawler')
@Controller('admin/crawler')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(USER_ROLES.ADMIN)
export class CrawlerController {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly crawlerService: CrawlerService,
    private readonly runControl: CrawlerRunControl,
    private readonly crawlerSettings: CrawlerSettingsRepository,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: '수집 전체 공통 설정 조회' })
  async getSettings() {
    return this.crawlerSettings.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: '수집 전체 공통 설정 수정 (공통 보존 단어)' })
  async updateSettings(@Body() body: { preservedTerms?: string | null }) {
    return this.crawlerSettings.updateSettings({
      preservedTerms: body.preservedTerms?.trim() || null,
    });
  }

  @Get('targets')
  @ApiOperation({ summary: '수집 대상 갤러리 목록 조회' })
  async getTargets() {
    return this.db.query.crawlerTargets.findMany({
      orderBy: [desc(schema.crawlerTargets.createdAt)],
      with: {
        targetBoard: true,
        botUser: true,
      },
    });
  }

  @Post('targets')
  @ApiOperation({ summary: '수집 대상 갤러리 등록' })
  async createTarget(
    @Body()
    body: {
      name: string;
      galleryId: string;
      targetBoardId: string;
      category?: string;
      minRecommendCount?: number;
      botUserId?: string;
      promptTone?: string;
      preservedTerms?: string;
      excludeKeywords?: string;
      collectLimit?: number;
      isActive?: boolean;
      enableComments?: boolean;
      commentsCount?: number;
      commentsCountMin?: number;
      commentsCountMax?: number;
      viewCountMin?: number;
      viewCountMax?: number;
      includeImages?: boolean;
      authorMainKeywords?: string;
      authorSubKeywords?: string;
      authorUseSub?: boolean;
      commentAuthorMainKeywords?: string;
      commentAuthorSubKeywords?: string;
      commentAuthorUseSub?: boolean;
      timeJitterMinMinutes?: number;
      timeJitterMaxMinutes?: number;
      postOrderMode?: string;
      onlyNewPosts?: boolean;
      crawlDirection?: string;
      pageMin?: number;
      pageMax?: number;
      crawlIntervalMinutes?: number;
      crawlIntervalMaxMinutes?: number | null;
      autoStopMinutes?: number;
    },
  ) {
    // 새로 등록한 갤러리는 [시작]을 누르기 전까지 멈춘 상태로 둔다 (등록하자마자 자동 수집·자동 정지 타이머가 돌지 않게)
    const isTargetActive = body.isActive ?? false;
    const [target] = await this.db
      .insert(schema.crawlerTargets)
      .values({
        name: body.name,
        galleryId: body.galleryId.trim(),
        targetBoardId: body.targetBoardId,
        category: body.category || null,
        minRecommendCount: body.minRecommendCount ?? 0,
        botUserId: body.botUserId || null,
        promptTone: body.promptTone || 'natural',
        preservedTerms: body.preservedTerms?.trim() || null,
        excludeKeywords: body.excludeKeywords?.trim() || null,
        collectLimit: body.collectLimit ?? 5,
        isActive: isTargetActive,
        enableComments: body.enableComments ?? true,
        commentsCount: body.commentsCount ?? 2,
        commentsCountMin: body.commentsCountMin ?? 0,
        commentsCountMax: body.commentsCountMax ?? 3,
        viewCountMin: body.viewCountMin ?? 5,
        viewCountMax: body.viewCountMax ?? 15,
        includeImages: body.includeImages ?? true,
        authorMainKeywords: body.authorMainKeywords || null,
        authorSubKeywords: body.authorSubKeywords || null,
        authorUseSub: body.authorUseSub ?? false,
        commentAuthorMainKeywords: body.commentAuthorMainKeywords || null,
        commentAuthorSubKeywords: body.commentAuthorSubKeywords || null,
        commentAuthorUseSub: body.commentAuthorUseSub ?? false,
        timeJitterMinMinutes: body.timeJitterMinMinutes ?? 10,
        timeJitterMaxMinutes: body.timeJitterMaxMinutes ?? 120,
        postOrderMode: toPostOrderMode(body.postOrderMode),
        onlyNewPosts: body.onlyNewPosts ?? false,
        crawlDirection: toCrawlDirection(body.crawlDirection),
        pageMin: body.pageMin ?? 1,
        pageMax: body.pageMax ?? 3,
        ...normalizeIntervalRange(body.crawlIntervalMinutes ?? 10, body.crawlIntervalMaxMinutes),
        autoStopMinutes: body.autoStopMinutes ?? 0,
        activatedAt: isTargetActive ? new Date() : null,
      })
      .returning();

    // '켠 이후 올라온 글만': 지금의 디시 최신 글 번호를 기준으로 적어 둔다
    if (target.onlyNewPosts) {
      const baseline = await this.crawlerService.captureNewPostsBaseline(target.id);
      return { ...target, newPostsAfterId: baseline };
    }
    return target;
  }

  @Patch('targets/:id')
  @ApiOperation({ summary: '수집 대상 갤러리 설정 수정' })
  async updateTarget(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      galleryId: string;
      targetBoardId: string;
      category: string;
      minRecommendCount: number;
      botUserId: string;
      promptTone: string;
      preservedTerms: string | null;
      excludeKeywords: string | null;
      collectLimit: number;
      isActive: boolean;
      enableComments: boolean;
      commentsCount: number;
      commentsCountMin: number;
      commentsCountMax: number;
      viewCountMin: number;
      viewCountMax: number;
      includeImages: boolean;
      authorMainKeywords: string;
      authorSubKeywords: string;
      authorUseSub: boolean;
      commentAuthorMainKeywords: string;
      commentAuthorSubKeywords: string;
      commentAuthorUseSub: boolean;
      timeJitterMinMinutes: number;
      timeJitterMaxMinutes: number;
      postOrderMode: string;
      onlyNewPosts: boolean;
      crawlDirection: string;
      pageMin: number;
      pageMax: number;
      crawlIntervalMinutes: number;
      crawlIntervalMaxMinutes: number | null;
      autoStopMinutes: number;
      activatedAt?: string | Date | null;
    }>,
  ) {
    const updateData: Record<string, any> = {
      ...body,
      updatedAt: new Date(),
    };

    // 기준 글 번호, 다음 수집 시각은 서버만 정한다
    delete updateData.newPostsAfterId;
    delete updateData.nextCrawlAt;
    // '켠 이후 올라온 글만'을 새로 켰거나, 수집 대상을 다시 켰거나, 갤러리를 바꾸면 기준 글 번호를 지금으로 다시 정한다
    const before = await this.db.query.crawlerTargets.findFirst({
      where: eq(schema.crawlerTargets.id, id),
    });
    const resetBaseline =
      !!before &&
      ((body.onlyNewPosts === true && !before.onlyNewPosts) ||
        (body.isActive === true && !before.isActive) ||
        (body.galleryId !== undefined && body.galleryId.trim() !== before.galleryId));
    if (resetBaseline) {
      updateData.newPostsAfterId = null;
    }
    // [시작]을 누르면(멈춤 → 동작) 직전 수집 시각과 상관없이 다음 1분 검사에서 바로 첫 수집을 하고, 그 뒤 주기마다 수집한다.
    // 정기 수집은 다음 수집 시각(없으면 마지막 수집 시각)으로 판단하므로, 둘 다 비우면 바로 대상이 된다
    // (타이머 연장 등 동작 중에 바꾸는 설정은 해당하지 않음)
    if (before && body.isActive === true && !before.isActive) {
      updateData.lastCrawledAt = null;
      updateData.nextCrawlAt = null;
    }
    if (before && (body.crawlIntervalMinutes !== undefined || body.crawlIntervalMaxMinutes !== undefined)) {
      const range = normalizeIntervalRange(
        body.crawlIntervalMinutes ?? before.crawlIntervalMinutes,
        body.crawlIntervalMaxMinutes !== undefined ? body.crawlIntervalMaxMinutes : before.crawlIntervalMaxMinutes,
      );
      Object.assign(updateData, range);
      // 동작 중에 주기를 바꾸면 다음 수집 시각을 새 주기로 다시 정한다 (마지막 수집 기준. 값이 같으면 그대로)
      const changed =
        range.crawlIntervalMinutes !== before.crawlIntervalMinutes ||
        range.crawlIntervalMaxMinutes !== before.crawlIntervalMaxMinutes;
      if (changed && updateData.nextCrawlAt === undefined && before.lastCrawledAt) {
        updateData.nextCrawlAt = pickNextCrawlAt(
          before.lastCrawledAt.getTime(),
          range.crawlIntervalMinutes,
          range.crawlIntervalMaxMinutes,
        );
      }
    }

    if (body.excludeKeywords !== undefined) {
      updateData.excludeKeywords = body.excludeKeywords?.trim() || null;
    }
    if (body.postOrderMode !== undefined) {
      updateData.postOrderMode = toPostOrderMode(body.postOrderMode);
    }
    if (body.crawlDirection !== undefined) {
      updateData.crawlDirection = toCrawlDirection(body.crawlDirection);
    }

    // 활성화 시점 처리
    if (body.activatedAt !== undefined) {
      updateData.activatedAt = body.activatedAt ? new Date(body.activatedAt) : null;
    } else if (body.isActive !== undefined) {
      updateData.activatedAt = body.isActive ? new Date() : null;
    }

    const [updated] = await this.db
      .update(schema.crawlerTargets)
      .set(updateData)
      .where(eq(schema.crawlerTargets.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException('Crawler target not found');
    }

    if (updated.onlyNewPosts && updated.newPostsAfterId == null) {
      const baseline = await this.crawlerService.captureNewPostsBaseline(updated.id);
      return { ...updated, newPostsAfterId: baseline };
    }

    return updated;
  }

  @Delete('targets/:id')
  @ApiOperation({ summary: '수집 대상 갤러리 삭제' })
  async deleteTarget(@Param('id') id: string) {
    const [deleted] = await this.db
      .delete(schema.crawlerTargets)
      .where(eq(schema.crawlerTargets.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException('Crawler target not found');
    }

    return { success: true };
  }

  @Post('targets/:id/trigger')
  @ApiOperation({ summary: '특정 갤러리 즉시 수집 및 리라이팅 시작 (백그라운드 실행)' })
  async triggerTarget(@Param('id') id: string) {
    await this.runControl.startTarget(id);
    return { message: 'Crawl started' };
  }

  @Post('targets/:id/cancel')
  @ApiOperation({ summary: '진행 중인 수집 작업 중지' })
  async cancelTarget(@Param('id') id: string) {
    const cancelled = await this.runControl.cancelTarget(id);
    return { cancelled };
  }

  @Get('status')
  @ApiOperation({ summary: '진행 중인 수집 작업 및 타겟별 마지막 수집 결과 조회' })
  getRunStatus() {
    return this.runControl.getRunStatus();
  }

  @Post('trigger-all')
  @ApiOperation({ summary: '활성화된 모든 대상 갤러리 일괄 수집 시작 (백그라운드 실행)' })
  async triggerAll() {
    await this.runControl.startBatch();
    return { message: 'Batch crawl started' };
  }

  @Post('trigger-all/cancel')
  @ApiOperation({ summary: '진행 중인 일괄 수집 중지' })
  async cancelAll() {
    const cancelled = await this.runControl.cancelBatch();
    return { cancelled };
  }

  @Get('logs')
  @ApiOperation({ summary: '최근 크롤링 및 발행 로그 조회' })
  async getLogs() {
    return this.db.query.crawlerLogs.findMany({
      orderBy: [desc(schema.crawlerLogs.createdAt)],
      limit: 100,
      with: {
        target: true,
        // 글은 지워지거나 비공개가 돼도 이력은 남는다 (이미 가져온 글을 다시 수집하지 않도록). 화면이 상태를 표시하도록 함께 내려준다
        createdPost: {
          columns: { id: true, title: true, boardId: true, deletedAt: true, hiddenAt: true },
          with: { board: { columns: { slug: true } } },
        },
      },
    });
  }

  @Get('posts/:postId/source')
  @Roles(USER_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: '봇이 등록한 게시글의 원본(디시인사이드) 글 주소 조회 (Super Admin 전용)' })
  async getPostSource(@Param('postId') postId: string) {
    const log = await this.db.query.crawlerLogs.findFirst({
      where: and(
        eq(schema.crawlerLogs.createdPostId, postId),
        eq(schema.crawlerLogs.status, 'SUCCESS'),
      ),
      columns: { sourceUrl: true, originalTitle: true },
    });
    if (!log) {
      throw new NotFoundException('원본 글 정보를 찾을 수 없습니다.');
    }
    return log;
  }

  @Delete('logs/:id')
  @ApiOperation({ summary: '수집 이력 및 연관 게시글/댓글/호스팅 이미지 영구 삭제' })
  async deleteLog(@Param('id') id: string) {
    const result = await this.crawlerService.deleteCrawlerLog(id);
    return {
      message: 'Log and associated data deleted',
      ...result,
    };
  }

  @Post('logs/delete-batch')
  @ApiOperation({ summary: '수집 이력 다건 및 연관 게시글/댓글/호스팅 이미지 일괄 삭제' })
  async deleteLogsBatch(@Body() body: { logIds: string[] }) {
    const result = await this.crawlerService.deleteCrawlerLogs(body.logIds || []);
    return {
      message: 'Logs and associated data deleted in batch',
      ...result,
    };
  }
}
