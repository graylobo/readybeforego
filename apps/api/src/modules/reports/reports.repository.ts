import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq, and, inArray, isNull, sql, SQL } from 'drizzle-orm';
import { reports, users, posts, comments, boards } from '../../database/schema';
import * as schema from '../../database/schema';
import { CreateReportRequest, ResolveReportRequest } from '@community/shared-types';

@Injectable()
export class ReportsRepository {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async hasUserReported(targetId: string, targetType: string, reporterId: string) {
    const existing = await this.db.select().from(reports).where(
      and(
        eq(reports.targetId, targetId),
        eq(reports.targetType, targetType),
        eq(reports.reporterId, reporterId)
      )
    ).limit(1);
    return existing.length > 0;
  }

  async createReport(data: CreateReportRequest & { reporterId: string | null }) {
    const [report] = await this.db.insert(reports).values(data).returning();
    return report;
  }

  async getReports(params: { page?: number; limit?: number; status?: string; targetType?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let conditions: SQL[] = [];
    if (params.status) {
      conditions.push(eq(reports.status, params.status as any));
    }
    if (params.targetType) {
      conditions.push(eq(reports.targetType, params.targetType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db.query.reports.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(reports.createdAt)],
      with: {
        reporter: {
          columns: {
            id: true,
            name: true,
            email: true,
          }
        },
        resolver: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    });

    const totalRes = await this.db.select({ count: sql<number>`count(*)` }).from(reports).where(whereClause);
    const total = Number(totalRes[0].count);

    const links = await this.findTargetLinks(results);
    const resultsWithUrls = results.map((report) => {
      const link = links.get(`${report.targetType}:${report.targetId}`);
      return { ...report, targetUrl: link?.url ?? '', targetDeleted: !link || link.deleted };
    });

    return { items: resultsWithUrls, total };
  }

  /**
   * 신고 대상(글/댓글)으로 가는 주소와 삭제 여부. 신고마다 따로 조회하지 않고 한 페이지 분량을 한 번에 조회한다
   * (댓글 → 그 댓글이 달린 글 → 게시판 순으로 필요한 것만 묶어서 2번)
   */
  private async findTargetLinks(list: { targetType: string; targetId: string }[]) {
    const links = new Map<string, { url: string; deleted: boolean }>();
    const commentIds = list.filter((r) => r.targetType === 'COMMENT').map((r) => r.targetId);
    const commentRows = commentIds.length
      ? await this.db
          .select({ id: comments.id, targetType: comments.targetType, targetId: comments.targetId, deletedAt: comments.deletedAt })
          .from(comments)
          .where(inArray(comments.id, commentIds))
      : [];
    const postIds = [
      ...list.filter((r) => r.targetType === 'POST').map((r) => r.targetId),
      ...commentRows.filter((c) => c.targetType === 'post').map((c) => c.targetId),
    ];
    const postRows = postIds.length
      ? await this.db
          .select({ id: posts.id, boardSlug: boards.slug, deletedAt: posts.deletedAt })
          .from(posts)
          .innerJoin(boards, eq(posts.boardId, boards.id))
          .where(inArray(posts.id, [...new Set(postIds)]))
      : [];
    const postMap = new Map(postRows.map((p) => [p.id, p]));

    for (const p of postRows) {
      links.set(`POST:${p.id}`, { url: `/board/${p.boardSlug}/${p.id}`, deleted: !!p.deletedAt });
    }
    for (const c of commentRows) {
      const post = c.targetType === 'post' ? postMap.get(c.targetId) : undefined;
      if (!post) continue;
      links.set(`COMMENT:${c.id}`, {
        url: `/board/${post.boardSlug}/${post.id}#comment-${c.id}`,
        deleted: !!c.deletedAt || !!post.deletedAt,
      });
    }
    return links;
  }

  /** 신고할 수 있는 대상인지 (있고 지워지지 않은 글/댓글) */
  async targetExists(targetType: string, targetId: string): Promise<boolean> {
    const table = targetType === 'POST' ? posts : targetType === 'COMMENT' ? comments : null;
    if (!table) return false;
    const [row] = await this.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, targetId), isNull(table.deletedAt)))
      .limit(1);
    return !!row;
  }

  async resolveReport(id: string, adminId: string, status: 'resolved' | 'rejected') {
    const [updated] = await this.db.update(reports)
      .set({
        status,
        resolvedAt: new Date(),
        resolvedBy: adminId,
      })
      .where(eq(reports.id, id))
      .returning();
    return updated;
  }
}
