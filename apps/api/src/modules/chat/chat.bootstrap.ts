import { INestApplication, Logger } from '@nestjs/common';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

/**
 * ChatModule이 Socket.IO Redis adapter 소유권을 갖는다.
 * 포크는 main.ts에서 이 함수 한 줄만 호출하면 된다.
 * 런타임 on/off는 chat_settings.enabled(관리자 설정)로 한다.
 */
export async function configureChatWebSocket(app: INestApplication): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const redisIoAdapter = new RedisIoAdapter(app, redisUrl, frontendUrl);
  const redisAdapterReady = await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const logger = new Logger('ChatBootstrap');
  if (redisAdapterReady) {
    logger.log('Socket.IO Redis adapter enabled (multi-instance chat)');
  } else {
    logger.warn(
      'Socket.IO Redis adapter unavailable — falling back to in-memory adapter (single instance only)',
    );
  }
}
