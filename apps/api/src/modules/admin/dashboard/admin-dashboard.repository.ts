import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
  SQL,
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  or,
  isNotNull,
  sql,
} from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { DashboardRange, fillSeries } from './dashboard-range';

export interface MetricCounts {
  total: number;
  /** 이번 기간에 새로 생긴 수 */
  current: number;
  /** 지난 기간(같은 길이, 같은 시점까지)에 새로 생긴 수 */
  previous: number;
  /** 날짜별 새로 생긴 수 (range.seriesDates 순서) */
  series: number[];
}

export interface PendingCount {
  count: number;
  oldestAt: Date | null;
}

/** 봇(콘텐츠 수집기)이 등록한 글은 지표에서 뺀다 */
const humanPosts = and(
  isNull(schema.posts.deletedAt),
  eq(schema.posts.isBot, false),
);
/**
 * 봇이 등록한 댓글은 회원도 아니고 비회원 비밀번호도 없다 (수집기가 닉네임만 넣어 등록).
 * 사람이 쓴 댓글은 회원이거나, 비회원이면 비밀번호가 반드시 있다.
 */
const humanComments = and(
  isNull(schema.comments.deletedAt),
  or(
    isNotNull(schema.comments.userId),
    isNotNull(schema.comments.guestPassword),
  ),
);

// created_at은 시간대 없는 UTC 시각이므로, 직접 비교할 때는 UTC 문자열로 넘긴다
// (Date를 그대로 넘기면 서버 시간대의 시각으로 해석돼 9시간 어긋난다)
const utc = (at: Date) => at.toISOString();

@Injectable()
export class AdminDashboardRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  countUsers(range: DashboardRange) {
    return this.countMetric(
      schema.users,
      schema.users.createdAt,
      undefined,
      range,
    );
  }

  countPosts(range: DashboardRange) {
    return this.countMetric(
      schema.posts,
      schema.posts.createdAt,
      humanPosts,
      range,
    );
  }

  countComments(range: DashboardRange) {
    return this.countMetric(
      schema.comments,
      schema.comments.createdAt,
      humanComments,
      range,
    );
  }

  async countBoards(range: DashboardRange) {
    const [row] = await this.db
      .select({
        total: count(),
        active:
          sql<number>`count(*) filter (where ${schema.boards.isActive})`.mapWith(
            Number,
          ),
        current:
          sql<number>`count(*) filter (where ${schema.boards.createdAt} >= ${utc(range.start)})`.mapWith(
            Number,
          ),
      })
      .from(schema.boards);
    return row;
  }

  /** 이번 기간에 사람이 쓴 글이 많은 게시판 */
  findTopBoards(range: DashboardRange, limit: number) {
    const postCount = count(schema.posts.id);
    return this.db
      .select({
        id: schema.boards.id,
        name: schema.boards.name,
        slug: schema.boards.slug,
        postCount,
      })
      .from(schema.posts)
      .innerJoin(schema.boards, eq(schema.boards.id, schema.posts.boardId))
      .where(and(humanPosts, gte(schema.posts.createdAt, range.start)))
      .groupBy(schema.boards.id)
      .orderBy(desc(postCount))
      .limit(limit);
  }

  findRecentModerationLogs(limit: number) {
    return this.db.query.userModerationLogs.findMany({
      limit,
      orderBy: [desc(schema.userModerationLogs.createdAt)],
      with: {
        user: { columns: { id: true, name: true } },
        admin: { columns: { id: true, name: true } },
      },
    });
  }

  async countPendingReports(): Promise<PendingCount> {
    const [row] = await this.db
      .select({
        count: count(),
        oldestAt: this.oldest(schema.reports.createdAt),
      })
      .from(schema.reports)
      .where(eq(schema.reports.status, 'pending'));
    return row;
  }

  async countPendingBoardRequests(): Promise<PendingCount> {
    const [row] = await this.db
      .select({
        count: count(),
        oldestAt: this.oldest(schema.boardRequests.createdAt),
      })
      .from(schema.boardRequests)
      .where(eq(schema.boardRequests.status, 'pending'));
    return row;
  }

  /** 답변(댓글)이 아직 없는 1:1 문의. 문의 게시판이 없으면 null */
  async countUnansweredInquiries(slug: string): Promise<PendingCount | null> {
    const [row] = await this.db
      .select({
        count: count(schema.posts.id),
        oldestAt: this.oldest(schema.posts.createdAt),
      })
      .from(schema.boards)
      .leftJoin(
        schema.posts,
        and(
          eq(schema.posts.boardId, schema.boards.id),
          isNull(schema.posts.deletedAt),
          eq(schema.posts.commentCount, 0),
        ),
      )
      .where(eq(schema.boards.slug, slug))
      .groupBy(schema.boards.id);
    return row ?? null;
  }

  async getCrawlerSummary(since: Date) {
    const [targets] = await this.db
      .select({
        active:
          sql<number>`count(*) filter (where ${schema.crawlerTargets.isActive})`.mapWith(
            Number,
          ),
        lastCrawledAt:
          sql<Date | null>`max(${schema.crawlerTargets.lastCrawledAt}) filter (where ${schema.crawlerTargets.isActive})`.mapWith(
            schema.crawlerTargets.lastCrawledAt,
          ),
        // 켜진 카드 중 가장 먼저 수집했어야 하는 시각 (이게 한참 지났으면 수집기가 멈춘 것)
        earliestNextCrawlAt:
          sql<Date | null>`min(${schema.crawlerTargets.nextCrawlAt}) filter (where ${schema.crawlerTargets.isActive})`.mapWith(
            schema.crawlerTargets.nextCrawlAt,
          ),
      })
      .from(schema.crawlerTargets);
    const [logs] = await this.db
      .select({
        succeeded:
          sql<number>`count(*) filter (where ${schema.crawlerLogs.status} = 'SUCCESS')`.mapWith(
            Number,
          ),
        failed:
          sql<number>`count(*) filter (where ${schema.crawlerLogs.status} = 'FAILED')`.mapWith(
            Number,
          ),
      })
      .from(schema.crawlerLogs)
      .where(gte(schema.crawlerLogs.createdAt, since));
    return { ...targets, ...logs };
  }

  private oldest(column: PgColumn) {
    return sql<Date | null>`min(${column})`.mapWith(
      (value) => column.mapFromDriverValue(value) as Date,
    );
  }

  private async countMetric(
    table: PgTable,
    createdAt: PgColumn,
    where: SQL | undefined,
    range: DashboardRange,
  ): Promise<MetricCounts> {
    const [counts] = await this.db
      .select({
        total: count(),
        current:
          sql<number>`count(*) filter (where ${createdAt} >= ${utc(range.start)})`.mapWith(
            Number,
          ),
        previous:
          sql<number>`count(*) filter (where ${createdAt} >= ${utc(range.previousStart)} and ${createdAt} < ${utc(range.previousEnd)})`.mapWith(
            Number,
          ),
      })
      .from(table)
      .where(where);
    const seriesStart = new Date(`${range.seriesDates[0]}T00:00:00+09:00`);
    const date = sql<string>`to_char(${createdAt} + interval '9 hours', 'YYYY-MM-DD')`;
    const daily = await this.db
      .select({ date, count: count() })
      .from(table)
      .where(and(where, gte(createdAt, seriesStart)))
      .groupBy(date);
    return { ...counts, series: fillSeries(range.seriesDates, daily) };
  }
}
