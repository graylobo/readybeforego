import { Global, Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

/** 채팅·알림이 함께 쓰는 Supabase Realtime 연결 (REALTIME_PROVIDER=supabase일 때만 동작) */
@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
