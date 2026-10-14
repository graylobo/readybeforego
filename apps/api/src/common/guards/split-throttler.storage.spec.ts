import { ThrottlerStorage } from '@nestjs/throttler';
import { LOCAL_THROTTLE_KEY_PREFIX, SplitThrottlerStorage } from './split-throttler.storage';

describe('SplitThrottlerStorage', () => {
  const shared: jest.Mocked<ThrottlerStorage> = {
    increment: jest.fn().mockResolvedValue({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    }),
  };
  let storage: SplitThrottlerStorage;

  beforeEach(() => {
    shared.increment.mockClear();
    storage = new SplitThrottlerStorage(shared);
  });

  afterEach(() => storage.onApplicationShutdown());

  it('조회 요청 키는 Redis를 거치지 않고 서버 메모리에서 세야 한다', async () => {
    const key = `${LOCAL_THROTTLE_KEY_PREFIX}abc`;
    await storage.increment(key, 60000, 2, 60000, 'default');
    await storage.increment(key, 60000, 2, 60000, 'default');
    const third = await storage.increment(key, 60000, 2, 60000, 'default');

    expect(shared.increment).not.toHaveBeenCalled();
    expect(third.totalHits).toBe(3);
    expect(third.isBlocked).toBe(true);
  });

  it('쓰기 요청 키는 모든 서버가 공유하는 Redis에서 세야 한다', async () => {
    await storage.increment('abc', 60000, 5, 60000, 'default');
    expect(shared.increment).toHaveBeenCalledWith('abc', 60000, 5, 60000, 'default');
  });
});
