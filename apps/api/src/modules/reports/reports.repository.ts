import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq, and, sql, SQL } from 'drizzle-orm';
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

    const resultsWithUrls = await Promise.all(results.map(async (report) => {
      let targetUrl = '';
      if (report.targetType === 'POST') {
        const postArray = await this.db
          .select({ id: posts.id, boardSlug: boards.slug })
          .from(posts)
          .innerJoin(boards, eq(posts.boardId, boards.id))
          .where(eq(posts.id, report.targetId))
          .limit(1);

        if (postArray.length > 0) {
          targetUrl = `/board/${postArray[0].boardSlug}/${postArray[0].id}`;
        }
      } else if (report.targetType === 'COMMENT') {
        const commentArray = await this.db.select().from(comments).where(eq(comments.id, report.targetId)).limit(1);
        if (commentArray.length > 0 && commentArray[0].targetType === 'post') {
          const postArray = await this.db
            .select({ id: posts.id, boardSlug: boards.slug })
            .from(posts)
            .innerJoin(boards, eq(posts.boardId, boards.id))
            .where(eq(posts.id, commentArray[0].targetId))
            .limit(1);

          if (postArray.length > 0) {
            targetUrl = `/board/${postArray[0].boardSlug}/${postArray[0].id}#comment-${commentArray[0].id}`;
          }
        }
      }
      return { ...report, targetUrl };
    }));

    return { items: resultsWithUrls, total };
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
