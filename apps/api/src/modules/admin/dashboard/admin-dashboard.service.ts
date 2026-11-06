import { Injectable } from '@nestjs/common';
import {
  AdminDashboardRepository,
  PendingCount,
} from './admin-dashboard.repository';
import { DashboardRangeDays, getDashboardRange } from './dashboard-range';

const TOP_BOARDS = 5;
const RECENT_MODERATION_LOGS = 5;
const INQUIRY_BOARD_SLUG = 'inquiry';
const HOUR_MS = 60 * 60 * 1000;
/** 켜진 수집 카드의 다음 수집 시각이 이만큼 지나도 수집하지 않았으면 멈춘 것으로 본다 */
const CRAWLER_OVERDUE_MS = 30 * 60 * 1000;

/** 관리자가 처리해야 할 일 (화면에서 key로 이름·이동할 곳을 정한다) */
export interface DashboardTask extends PendingCount {
  key: string;
}

export type DashboardSystemState = 'ok' | 'warning' | 'error' | 'idle';

/** 서버 기능의 상태 (화면에서 key로 이름을 정한다) */
export interface DashboardSystem {
  key: string;
  state: DashboardSystemState;
  message: string;
  checkedAt: Date | null;
}

/**
 * 관리자 대시보드.
 * 지표는 기간을 골라 보는 무거운 집계라 따로, 처리할 일은 사이드바 배지에서도 자주 보므로 가벼운 집계로 따로 둔다.
 * 파생 프로젝트는 getTasks·getSystems에 자기 항목을 더한다.
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly repo: AdminDashboardRepository) {}

  async getDashboard(days: DashboardRangeDays) {
    const range = getDashboardRange(days);
    const [
      users,
      posts,
      comments,
      boards,
      topBoards,
      recentModerationLogs,
      systems,
    ] = await Promise.all([
      this.repo.countUsers(range),
      this.repo.countPosts(range),
      this.repo.countComments(range),
      this.repo.countBoards(range),
      this.repo.findTopBoards(range, TOP_BOARDS),
      this.repo.findRecentModerationLogs(RECENT_MODERATION_LOGS),
      this.getSystems(),
    ]);
    return {
      range: {
        days,
        start: range.start,
        seriesDates: range.seriesDates,
      },
      metrics: { users, posts, comments, boards },
      topBoards,
      recentModerationLogs,
      systems,
    };
  }

  async getTasks(): Promise<DashboardTask[]> {
    const [reports, inquiries, boardRequests] = await Promise.all([
      this.repo.countPendingReports(),
      this.repo.countUnansweredInquiries(INQUIRY_BOARD_SLUG),
      this.repo.countPendingBoardRequests(),
    ]);
    return [
      { key: 'reports', ...reports },
      ...(inquiries ? [{ key: 'inquiries', ...inquiries }] : []),
      { key: 'boardRequests', ...boardRequests },
    ];
  }

  async getSystems(): Promise<DashboardSystem[]> {
    return [await this.getCrawlerSystem()];
  }

  private async getCrawlerSystem(now = new Date()): Promise<DashboardSystem> {
    const crawler = await this.repo.getCrawlerSummary(
      new Date(now.getTime() - 24 * HOUR_MS),
    );
    const base = { key: 'crawler', checkedAt: crawler.lastCrawledAt };
    if (crawler.active === 0) {
      return { ...base, state: 'idle', message: '켜진 수집 카드가 없습니다' };
    }
    const results = `최근 24시간 성공 ${crawler.succeeded} · 실패 ${crawler.failed}`;
    if (
      crawler.earliestNextCrawlAt &&
      now.getTime() - crawler.earliestNextCrawlAt.getTime() > CRAWLER_OVERDUE_MS
    ) {
      return {
        ...base,
        state: 'error',
        message: '수집할 시각이 30분 넘게 지났는데 수집하지 않았습니다',
      };
    }
    if (crawler.failed > 0) {
      return {
        ...base,
        state: crawler.succeeded === 0 ? 'error' : 'warning',
        message: results,
      };
    }
    return {
      ...base,
      state: 'ok',
      message: `수집 카드 ${crawler.active}개 · ${results}`,
    };
  }
}
