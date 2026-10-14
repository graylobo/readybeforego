import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        if (!connectionString) {
          throw new Error('DATABASE_URL environment variable is required');
        }

        // 관리형 Postgres는 인스턴스별 커넥션 수가 제한적이므로 풀 상한을 명시한다.
        // (다중 인스턴스 환경에서 max * 인스턴스 수가 DB 허용치를 넘지 않도록 조정)
        const poolMax = Number(configService.get<string>('DATABASE_POOL_MAX') ?? 10);

        // 운영/관리형 DB는 TLS가 필요하다. 연결 문자열에 sslmode가 없으면
        // DATABASE_SSL=true 또는 production 환경에서 SSL을 활성화한다.
        const sslEnabled =
          configService.get<string>('DATABASE_SSL') === 'true' ||
          (process.env.NODE_ENV === 'production' &&
            !/sslmode=/.test(connectionString));

        // 쉬는 연결을 너무 빨리 닫으면, 트래픽이 뜸할 때마다 첫 요청이 DB와 TCP+TLS 연결을 새로 맺느라 느려진다.
        // 기본 5분 동안 유지하고, keepAlive로 중간 네트워크 장비가 쉬는 연결을 끊지 않게 한다.
        const idleTimeoutMillis = Number(
          configService.get<string>('DATABASE_POOL_IDLE_TIMEOUT_MS') ?? 300000,
        );

        const pool = new Pool({
          connectionString,
          max: poolMax,
          idleTimeoutMillis,
          connectionTimeoutMillis: 10000,
          keepAlive: true,
          ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
        });

        // 쉬는 연결이 DB/풀러 쪽에서 끊기면 pool이 'error'를 발생시키는데, 처리기가 없으면 프로세스가 종료된다.
        // 끊긴 연결은 풀에서 제거되고 다음 요청 때 새로 연결되므로 기록만 남긴다.
        pool.on('error', (err) => {
          new Logger('DatabasePool').warn(`Idle client error: ${err.message}`);
        });

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
