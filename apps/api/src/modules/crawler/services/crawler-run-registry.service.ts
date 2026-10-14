import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../../redis/redis.constants';

// 대기(queued) 상태의 유효 시간. 워커가 이 시간 안에 작업을 집어가지 않으면(워커 다운 등) 자동으로 풀린다.
const QUEUED_TTL_MS = 5 * 60_000;
// 실행(running) 상태의 유효 시간. 실행 중인 프로세스가 하트비트로 계속 연장하며,
// 프로세스가 죽으면 이 시간이 지나 자동으로 풀린다.
const RUN_LOCK_TTL_MS = 30_000;
// 하트비트 주기: 락 연장 + 다른 프로세스에서 들어온 중지 요청 확인
const HEARTBEAT_INTERVAL_MS = 2_000;
const CANCEL_TTL_SECONDS = 600;
const RESULT_TTL_SECONDS = 24 * 60 * 60;

const KEY_PREFIX = 'crawler';
export const BATCH_RUN_ID = 'batch';

// 대기 중인 내 작업을 실행 상태로 전환 (워커가 작업을 집어갈 때)
const CLAIM_IF_QUEUED = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local meta = cjson.decode(raw)
if meta.runId ~= ARGV[1] or meta.state ~= 'queued' then return 0 end
meta.state = 'running'
redis.call('SET', KEYS[1], cjson.encode(meta), 'PX', ARGV[2])
return 1`;
// 내 runId일 때만 연장 (락이 만료되어 다른 작업이 가져간 경우를 건드리지 않도록)
const EXTEND_IF_OWNER = `
local raw = redis.call('GET', KEYS[1])
if raw and cjson.decode(raw).runId == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0`;
// 내 runId일 때만 삭제. ARGV[2]가 있으면 해당 상태일 때만 삭제 (대기 중 취소 시 실행으로 전환된 작업을 지우지 않도록)
const DELETE_IF_OWNER = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local meta = cjson.decode(raw)
if meta.runId ~= ARGV[1] then return 0 end
if ARGV[2] and ARGV[2] ~= '' and meta.state ~= ARGV[2] then return 0 end
return redis.call('DEL', KEYS[1])`;

export type RunState = 'queued' | 'running';

export interface RunMeta {
  runId: string;
  state: RunState;
  isManual: boolean;
  startedAt: string;
}

export interface RunHandle {
  signal: AbortSignal;
  release(): Promise<void>;
}

export type CancelOutcome =
  // 실행 전(대기 중)이라 바로 취소됨
  | 'dequeued'
  // 실행 중인 작업에 중지 신호를 보냄
  | 'signalled'
  | 'not-running';

/**
 * 크롤러 실행 상태를 Redis에 보관해 API 인스턴스들과 워커 프로세스 간에 공유한다.
 * 실행 환경(BullMQ 워커, Cloud Run Job, API 프로세스 내부)과 무관하게 동일하게 동작한다.
 *
 * - 실행 표시(락): reserve(대기) → claim(실행) 2단계. 같은 대상이 동시에 두 번 수집되지 않도록 막고,
 *   어느 인스턴스로 조회해도 진행 상태가 보이게 한다.
 * - 중지 요청: 대기 중이면 즉시 취소하고, 실행 중이면 실행 중인 프로세스가 하트비트에서 감지해 중단한다.
 * - 마지막 결과: 새로고침/다른 인스턴스 조회 시에도 완료 결과를 확인할 수 있게 한다.
 *
 * id는 타겟 id 또는 일괄 수집용 BATCH_RUN_ID.
 */
@Injectable()
export class CrawlerRunRegistry {
  private readonly logger = new Logger(CrawlerRunRegistry.name);
  // 이 프로세스에서 실행 중인 작업 (같은 프로세스로 들어온 중지 요청은 하트비트를 기다리지 않고 즉시 반영)
  private readonly localControllers = new Map<string, AbortController>();

  constructor(@Inject(REDIS_PUBLISHER) private readonly redis: Redis) {}

  private runKey(id: string) {
    return `${KEY_PREFIX}:run:${id}`;
  }

  private cancelKey(id: string) {
    return `${KEY_PREFIX}:cancel:${id}`;
  }

  private resultKey(id: string) {
    return `${KEY_PREFIX}:result:${id}`;
  }

  /**
   * 실행 예약(대기 상태). 이미 대기/실행 중이면 null, 성공하면 runId.
   */
  async reserve(id: string, isManual: boolean): Promise<string | null> {
    const meta: RunMeta = {
      runId: randomUUID(),
      state: 'queued',
      isManual,
      startedAt: new Date().toISOString(),
    };
    const ok = await this.redis.set(
      this.runKey(id),
      JSON.stringify(meta),
      'PX',
      QUEUED_TTL_MS,
      'NX',
    );
    return ok === 'OK' ? meta.runId : null;
  }

  /**
   * 예약을 실행으로 전환. 예약이 취소/만료되었거나 이미 실행 중이면 null.
   * parentSignal이 중단되면 이 작업도 함께 중단된다 (일괄 수집 중지 시 진행 중인 타겟까지 중지).
   */
  async claim(
    id: string,
    runId: string,
    parentSignal?: AbortSignal,
  ): Promise<RunHandle | null> {
    const claimed = await this.redis.eval(
      CLAIM_IF_QUEUED,
      1,
      this.runKey(id),
      runId,
      RUN_LOCK_TTL_MS,
    );
    if (claimed !== 1) {
      return null;
    }

    const controller = new AbortController();
    this.localControllers.set(id, controller);

    const onParentAbort = () => controller.abort();
    if (parentSignal?.aborted) {
      controller.abort();
    } else {
      parentSignal?.addEventListener('abort', onParentAbort, { once: true });
    }

    const heartbeat = setInterval(() => {
      void this.beat(id, runId, controller);
    }, HEARTBEAT_INTERVAL_MS);

    return {
      signal: controller.signal,
      release: async () => {
        clearInterval(heartbeat);
        parentSignal?.removeEventListener('abort', onParentAbort);
        this.localControllers.delete(id);
        try {
          await this.redis.eval(DELETE_IF_OWNER, 1, this.runKey(id), runId, '');
          await this.redis.del(this.cancelKey(id));
        } catch (err) {
          this.logger.error(
            `Failed to release crawler run lock for ${id}`,
            err,
          );
        }
      },
    };
  }

  /**
   * reserve + claim 을 한 번에 (스케줄 실행, 일괄 수집 내부의 타겟 수집처럼 같은 프로세스에서 바로 실행할 때)
   */
  async acquire(
    id: string,
    isManual: boolean,
    parentSignal?: AbortSignal,
  ): Promise<RunHandle | null> {
    const runId = await this.reserve(id, isManual);
    return runId ? this.claim(id, runId, parentSignal) : null;
  }

  /**
   * 예약 취소 (작업 전달에 실패했을 때)
   */
  async discard(id: string, runId: string): Promise<void> {
    await this.redis.eval(DELETE_IF_OWNER, 1, this.runKey(id), runId, 'queued');
  }

  private async beat(id: string, runId: string, controller: AbortController) {
    try {
      await this.redis.eval(
        EXTEND_IF_OWNER,
        1,
        this.runKey(id),
        runId,
        RUN_LOCK_TTL_MS,
      );
      if (
        !controller.signal.aborted &&
        (await this.redis.get(this.cancelKey(id))) === runId
      ) {
        controller.abort();
      }
    } catch (err) {
      this.logger.error(`Crawler heartbeat failed for ${id}`, err);
    }
  }

  async isRunning(id: string): Promise<boolean> {
    return (await this.redis.exists(this.runKey(id))) === 1;
  }

  async requestCancel(id: string): Promise<CancelOutcome> {
    const raw = await this.redis.get(this.runKey(id));
    if (!raw) {
      return 'not-running';
    }
    const meta = JSON.parse(raw) as RunMeta;

    if (meta.state === 'queued') {
      const deleted = await this.redis.eval(
        DELETE_IF_OWNER,
        1,
        this.runKey(id),
        meta.runId,
        'queued',
      );
      if (deleted === 1) {
        return 'dequeued';
      }
      // 그 사이 워커가 실행으로 전환했다면 실행 중 작업으로 보고 중지 신호를 보낸다
    }

    await this.redis.set(
      this.cancelKey(id),
      meta.runId,
      'EX',
      CANCEL_TTL_SECONDS,
    );
    this.localControllers.get(id)?.abort();
    return 'signalled';
  }

  async saveResult<T extends object>(id: string, result: T): Promise<void> {
    try {
      await this.redis.set(
        this.resultKey(id),
        JSON.stringify({ ...result, finishedAt: new Date().toISOString() }),
        'EX',
        RESULT_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.error(`Failed to save crawler result for ${id}`, err);
    }
  }

  /**
   * 주어진 id들의 실행 상태와 마지막 결과를 한 번에 조회
   */
  async getStatuses<T>(ids: string[]): Promise<
    Map<
      string,
      {
        running: (RunMeta & { cancelRequested: boolean }) | null;
        lastResult: (T & { finishedAt: string }) | null;
      }
    >
  > {
    const statuses = new Map();
    if (ids.length === 0) {
      return statuses;
    }

    const keys = ids.flatMap((id) => [
      this.runKey(id),
      this.cancelKey(id),
      this.resultKey(id),
    ]);
    const values = await this.redis.mget(keys);

    ids.forEach((id, i) => {
      const [rawRun, cancelRunId, rawResult] = values.slice(i * 3, i * 3 + 3);
      const run = rawRun ? (JSON.parse(rawRun) as RunMeta) : null;
      statuses.set(id, {
        running: run
          ? { ...run, cancelRequested: cancelRunId === run.runId }
          : null,
        lastResult: rawResult ? JSON.parse(rawResult) : null,
      });
    });
    return statuses;
  }
}
