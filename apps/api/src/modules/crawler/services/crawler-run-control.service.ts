import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import {
  BATCH_RUN_ID,
  CrawlerRunRegistry,
} from './crawler-run-registry.service';
import { CRAWLER_DISPATCHER } from '../dispatchers/crawler-dispatcher.interface';
import type { CrawlerDispatcher } from '../dispatchers/crawler-dispatcher.interface';
import {
  BatchCrawlResult,
  CrawlerCommand,
  CrawlResult,
  emptyCrawlResult,
} from '../interfaces/crawler-run.interface';

/**
 * API 측 수집 제어 (시작 / 중지 / 상태 조회).
 * 실제 실행은 하지 않고, 실행 예약 후 CrawlerDispatcher로 명령만 넘긴다.
 */
@Injectable()
export class CrawlerRunControl {
  private readonly logger = new Logger(CrawlerRunControl.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly runRegistry: CrawlerRunRegistry,
    @Inject(CRAWLER_DISPATCHER)
    private readonly dispatcher: CrawlerDispatcher,
  ) {}

  /**
   * 수동 1회 수집 시작 (요청은 즉시 반환되고 진행 상태는 getRunStatus로 조회)
   */
  async startTarget(targetId: string): Promise<void> {
    const target = await this.db.query.crawlerTargets.findFirst({
      where: eq(schema.crawlerTargets.id, targetId),
    });
    if (!target) {
      throw new NotFoundException('Crawler target not found');
    }

    const runId = await this.runRegistry.reserve(targetId, true);
    if (!runId) {
      throw new ConflictException('이미 수집이 진행 중입니다.');
    }
    await this.dispatchOrDiscard(targetId, { type: 'target', targetId, runId });
  }

  /**
   * 활성화된 모든 타겟 일괄 수집 시작
   */
  async startBatch(): Promise<void> {
    const runId = await this.runRegistry.reserve(BATCH_RUN_ID, true);
    if (!runId) {
      throw new ConflictException('이미 일괄 수집이 진행 중입니다.');
    }
    await this.dispatchOrDiscard(BATCH_RUN_ID, { type: 'batch', runId });
  }

  private async dispatchOrDiscard(
    id: string,
    command: CrawlerCommand,
  ): Promise<void> {
    try {
      await this.dispatcher.dispatch(command);
    } catch (err) {
      await this.runRegistry.discard(id, command.runId);
      throw err;
    }
  }

  /**
   * 진행 중인 수집 중지 (대기 중이면 즉시 취소, 실행 중이면 현재 단계가 끝나는 즉시 중단)
   */
  async cancelTarget(targetId: string): Promise<boolean> {
    return this.cancel(targetId, emptyCrawlResult(true));
  }

  /**
   * 진행 중인 일괄 수집 중지 (진행 중인 타겟 수집도 함께 중단)
   */
  async cancelBatch(): Promise<boolean> {
    const result: BatchCrawlResult = {
      totalCollected: 0,
      totalErrors: 0,
      cancelled: true,
    };
    return this.cancel(BATCH_RUN_ID, result);
  }

  private async cancel(id: string, dequeuedResult: object): Promise<boolean> {
    const outcome = await this.runRegistry.requestCancel(id);
    if (outcome === 'dequeued') {
      // 실행 전에 취소되어 실행 측이 결과를 남기지 않으므로 여기서 남긴다
      await this.runRegistry.saveResult(id, dequeuedResult);
    }
    if (outcome !== 'not-running') {
      this.logger.log(`Cancel requested for ${id} (${outcome})`);
    }
    return outcome !== 'not-running';
  }

  /**
   * 진행 중인 수집 작업 목록과 마지막 수집 결과 조회 (개별 타겟 + 일괄 수집)
   */
  async getRunStatus() {
    const targets = await this.db.query.crawlerTargets.findMany({
      columns: { id: true },
    });
    const statuses = await this.runRegistry.getStatuses<CrawlResult>(
      targets.map((t) => t.id),
    );
    const batchStatus = (
      await this.runRegistry.getStatuses<BatchCrawlResult>([BATCH_RUN_ID])
    ).get(BATCH_RUN_ID);

    const running: {
      targetId: string;
      state: 'queued' | 'running';
      isManual: boolean;
      startedAt: string;
      cancelRequested: boolean;
    }[] = [];
    const lastResults: Record<string, CrawlResult & { finishedAt: string }> =
      {};
    statuses.forEach((status, targetId) => {
      if (status.running) {
        const { state, isManual, startedAt, cancelRequested } = status.running;
        running.push({ targetId, state, isManual, startedAt, cancelRequested });
      }
      if (status.lastResult) {
        lastResults[targetId] = status.lastResult;
      }
    });

    return {
      running,
      lastResults,
      batch: batchStatus?.running
        ? {
            state: batchStatus.running.state,
            startedAt: batchStatus.running.startedAt,
            cancelRequested: batchStatus.running.cancelRequested,
          }
        : null,
      lastBatchResult: batchStatus?.lastResult ?? null,
    };
  }
}
