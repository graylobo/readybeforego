import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { USER_ROLES } from '@community/shared-types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import { parseRangeDays } from './dashboard-range';

@ApiTags('admin')
@Controller('admin/dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(USER_ROLES.ADMIN)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  @ApiOperation({ summary: '관리자 대시보드 지표 (봇이 등록한 글·댓글 제외)' })
  @ApiQuery({
    name: 'days',
    required: false,
    enum: [1, 7, 30],
    description: '기간 (기본 7일)',
  })
  getDashboard(@Query('days') days?: string) {
    return this.dashboard.getDashboard(parseRangeDays(days));
  }

  @Get('tasks')
  @ApiOperation({
    summary: '관리자가 처리할 일 (대기 건수와 가장 오래된 건의 시각)',
  })
  getTasks() {
    return this.dashboard.getTasks();
  }
}
