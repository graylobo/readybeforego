import { OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

// 이 접두사로 시작하는 키는 서버 메모리에서 센다 (CustomThrottlerGuard.generateKey에서 붙임)
export const LOCAL_THROTTLE_KEY_PREFIX = 'local:';

/**
 * 요청 횟수 제한 기록을 요청 종류에 따라 나눠 저장하는 저장소
 *
 * - 조회(GET 등) 요청: 서버 메모리. 매 요청마다 Redis를 다녀오는 시간(수십 ms)을 없앤다.
 *   서버가 여러 대면 서버별로 따로 세어지지만, 조회 한도는 넉넉해서 문제가 되지 않는다.
 * - 쓰기(POST 등) 요청: Redis. 글쓰기/댓글 도배 방지 한도는 모든 서버가 함께 정확히 센다.
 */
export class SplitThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly local = new ThrottlerStorageService();

  constructor(private readonly shared: ThrottlerStorage) {}

  increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const storage = key.startsWith(LOCAL_THROTTLE_KEY_PREFIX) ? this.local : this.shared;
    return storage.increment(key, ttl, limit, blockDuration, throttlerName);
  }

  onApplicationShutdown() {
    this.local.onApplicationShutdown();
  }
}
