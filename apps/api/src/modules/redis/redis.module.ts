import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from './redis.constants';

function createRedisClient(configService: ConfigService): Redis {
  const url = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
  const options: Record<string, unknown> = {
    keepAlive: 10000,
  };
  if (url.startsWith('rediss://')) {
    options.tls = { rejectUnauthorized: false };
  }
  return new Redis(url, options);
}

@Module({
  providers: [
    {
      provide: REDIS_PUBLISHER,
      useFactory: createRedisClient,
      inject: [ConfigService],
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: createRedisClient,
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_PUBLISHER, REDIS_SUBSCRIBER],
})
export class RedisModule {}
