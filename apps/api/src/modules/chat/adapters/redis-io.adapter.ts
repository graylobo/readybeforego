import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * 다중 API 인스턴스에서도 같은 채팅방을 공유하기 위한 Socket.IO Redis Adapter.
 * Redis에 연결하지 못하면 인메모리 어댑터를 쓰되, 채팅 기능 자체는 Redis가
 * 살아 있을 때만 동작한다. 인메모리 어댑터는 "채팅 불가"를 클라이언트에
 * 알리기 위한 연결용이지 로비 폴백이 아니다.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplication,
    private readonly redisUrl: string,
    private readonly frontendUrl: string,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<boolean> {
    let pubClient: Redis | null = null;
    let subClient: Redis | null = null;
    try {
      const options: Record<string, unknown> = {
        keepAlive: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times: number) => Math.min(times * 200, 2000),
      };
      if (this.redisUrl.startsWith('rediss://')) {
        options.tls = { rejectUnauthorized: false };
      }

      pubClient = new Redis(this.redisUrl, options);
      subClient = pubClient.duplicate();

      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Redis adapter connect timeout')), 3000);
        }),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      return true;
    } catch {
      this.adapterConstructor = null;
      pubClient?.disconnect();
      subClient?.disconnect();
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.frontendUrl,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 20000,
      pingTimeout: 25000,
      maxHttpBufferSize: 1e4,
    } as ServerOptions);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
