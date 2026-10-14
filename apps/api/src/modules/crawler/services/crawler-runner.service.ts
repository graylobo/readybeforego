import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { CrawlerService } from './crawler.service';
import {
  BATCH_RUN_ID,
  CrawlerRunRegistry,
  RunHandle,
} from './crawler-run-registry.service';
import {
  BatchCrawlResult,
  CrawlerCommand,
  CrawlResult,
  emptyCrawlResult,
} from '../interfaces/crawler-run.interface';
import { pickNextCrawlAt, planScheduledRun } from '../utils/crawl-schedule';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 수집 실행 측 진입점. 실행 환경(BullMQ 워커, Cloud Run Job, API 프로세스 내부)과 무관하게
 * 여기의 메서드만 호출하면 실행 락, 중지 요청, 결과 저장이 동일하게 처리된다.
 */
@Injectable()
export class CrawlerRunner {
  private readonly logger = new Logger(CrawlerRunner.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly crawlerService: CrawlerService,
    private readonly runRegistry: CrawlerRunRegistry,
    private readonly configService: ConfigService,
  ) {}

  /**
   * API가 예약(reserve)하고 전달한 명령 실행
   */
  async execute(command: CrawlerCommand): Promise<void> {
    const id = command.type === 'batch' ? BATCH_RUN_ID : command.targetId;
    const handle = await this.runRegistry.claim(id, command.runId);
    if (!handle) {
      // 대기 중 취소되었거나, 만료되었거나, 같은 명령이 이미 실행 중(재전달)인 경우
      this.logger.warn(
        `Crawler command ${command.type}:${id} (run ${command.runId}) is no longer claimable. Skipping.`,
      );
      return;
    }

    if (command.type === 'batch') {
      await this.withHandle(BATCH_RUN_ID, handle, () =>
        this.crawlAllActiveTargets(handle.signal),
      );
    } else {
      await this.withHandle(command.targetId, handle, () =>
        this.crawlerService.crawlTarget(command.targetId, true, handle.signal),
      );
    }
  }

  /**
   * 예약 없이 바로 실행 (스케줄 실행, 일괄 수집 내부). 이미 실행 중이면 건너뜀.
   */
  async runTarget(
    targetId: string,
    isManual: boolean,
    parentSignal?: AbortSignal,
  ): Promise<CrawlResult> {
    const handle = await this.runRegistry.acquire(
      targetId,
      isManual,
      parentSignal,
    );
    if (!handle) {
      this.logger.warn(
        `Target ${targetId} is already being crawled. Skipping.`,
      );
      return emptyCrawlResult();
    }
    return this.withHandle(targetId, handle, () =>
      this.crawlerService.crawlTarget(targetId, isManual, handle.signal),
    );
  }

  private async withHandle<T extends object>(
    id: string,
    handle: RunHandle,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      const result = await run();
      await this.runRegistry.saveResult(id, result);
      return result;
    } catch (err) {
      // 실패도 결과로 남겨야 화면에서 완료(실패) 여부를 알 수 있다
      this.logger.error(`Crawler run ${id} failed`, err);
      await this.runRegistry.saveResult(id, {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      await handle.release();
    }
  }

  private async crawlAllActiveTargets(
    signal: AbortSignal,
  ): Promise<BatchCrawlResult> {
    const targets = await this.db.query.crawlerTargets.findMany({
      where: eq(schema.crawlerTargets.isActive, true),
    });

    let totalCollected = 0;
    let totalErrors = 0;

    for (const target of targets) {
      if (signal.aborted) {
        break;
      }
      const result = await this.runTarget(target.id, false, signal);
      totalCollected += result.collected;
      totalErrors += result.errors;
    }

    return { totalCollected, totalErrors, cancelled: signal.aborted };
  }

  /**
   * 정기 수집 1회 검사:
   * 활성화된(isActive = true) 각 타겟의 다음 수집 시각(nextCrawlAt)을 확인하고,
   * 설정된 시간이 도래한 타겟들만 각각 독립적으로 크롤링 및 LLM 리라이팅 실행.
   * 시작한 수집이 모두 끝나면 resolve 된다 (상시 워커는 기다리지 않고, 단발성 Job은 기다린 뒤 종료).
   */
  async runScheduledTick(): Promise<void> {
    const isGloballyDisabled =
      this.configService.get<string>('CRAWLER_AUTO_SCHEDULE_ENABLED') ===
      'false';
    if (isGloballyDisabled) {
      return;
    }

    const runs: Promise<unknown>[] = [];

    try {
      // 1. 활성화된 모든 대상 갤러리 조회
      const targets = await this.db.query.crawlerTargets.findMany({
        where: eq(schema.crawlerTargets.isActive, true),
      });

      const now = Date.now();

      // 2. 각 타겟의 개별 주기 및 자동 정지 타이머 판별
      for (const target of targets) {
        // 이미 해당 타겟 크롤링 작업이 진행 중이면 이번 사이클은 스킵
        if (await this.runRegistry.isRunning(target.id)) {
          continue;
        }

        // [자동 정지 타이머 검사]: autoStopMinutes가 설정되어 있고, 활성화된 지 해당 시간이 경과했으면 자동 비활성화(OFF)
        if (target.autoStopMinutes && target.autoStopMinutes > 0) {
          const activatedMs = target.activatedAt
            ? target.activatedAt.getTime()
            : target.createdAt
              ? target.createdAt.getTime()
              : now;
          const elapsedMinutes = (now - activatedMs) / (60 * 1000);

          if (elapsedMinutes >= target.autoStopMinutes) {
            this.logger.log(
              `[Auto-Stop] Target "${target.name}" reached timer limit of ${target.autoStopMinutes}m (elapsed: ${Math.floor(elapsedMinutes)}m). Automatically turning OFF.`,
            );
            await this.db
              .update(schema.crawlerTargets)
              .set({
                isActive: false,
                activatedAt: null,
                updatedAt: new Date(),
              })
              .where(eq(schema.crawlerTargets.id, target.id));
            continue;
          }
        }

        // 수집 시각이 됐는가? (다음 수집 시각은 지난 수집 때 주기 범위에서 무작위로 정해 둠, utils/crawl-schedule.ts)
        const plan = planScheduledRun({
          nowMs: now,
          lastCrawledAt: target.lastCrawledAt,
          nextCrawlAt: target.nextCrawlAt,
          intervalMinutes: target.crawlIntervalMinutes,
        });
        if (plan.due) {
          // 다음 수집 시각을 지금 정해 둔다 (기다리는 동안 다음 검사가 같은 수집을 또 시작하지 않게)
          const startAtMs = now + plan.delayMs;
          await this.db
            .update(schema.crawlerTargets)
            .set({
              nextCrawlAt: pickNextCrawlAt(startAtMs, target.crawlIntervalMinutes, target.crawlIntervalMaxMinutes),
            })
            .where(eq(schema.crawlerTargets.id, target.id));
          // 비동기 실행 (다른 타겟의 실행을 블로킹하지 않음)
          runs.push(this.executeScheduledCrawl(target, plan.delayMs));
        }
      }
    } catch (error) {
      this.logger.error('Error checking scheduled crawler targets', error);
    }

    await Promise.all(runs);
  }

  private async executeScheduledCrawl(
    target: typeof schema.crawlerTargets.$inferSelect,
    delayMs: number,
  ) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    const interval =
      target.crawlIntervalMaxMinutes && target.crawlIntervalMaxMinutes > target.crawlIntervalMinutes
        ? `${target.crawlIntervalMinutes}~${target.crawlIntervalMaxMinutes}`
        : `${target.crawlIntervalMinutes || 10}`;
    this.logger.log(
      `[Scheduled] Triggering target "${target.name}" (${target.galleryId}) - Interval: ${interval}m`,
    );

    try {
      const result = await this.runTarget(target.id, false);
      this.logger.log(
        `[Scheduled] Target "${target.name}" completed: Collected ${result.collected}, Skipped ${result.skipped}, Errors ${result.errors}`,
      );
    } catch (err) {
      this.logger.error(`[Scheduled] Target "${target.name}" failed`, err);
    }
  }
}
