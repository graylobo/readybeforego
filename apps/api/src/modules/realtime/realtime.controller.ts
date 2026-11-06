import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RealtimeService } from './realtime.service';

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Get('config')
  @ApiOperation({ summary: '실시간 연결 방식 (Supabase Realtime이면 접속 주소와 공개 키)' })
  getConfig() {
    return this.realtime.publicConfig();
  }
}
