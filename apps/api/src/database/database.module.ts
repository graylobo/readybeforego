import { Module, Global } from '@nestjs/common';
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

        const pool = new Pool({
          connectionString,
          max: poolMax,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
        });

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
