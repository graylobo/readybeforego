import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { USER_ROLES } from '@community/shared-types';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';
import { CreateReportZodDto, ResolveReportZodDto } from './dto/reports.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '신고하기 (인증 필요없음 - 익명 허용 시 / 하지만 현재 로그인 권장)' })
  @UsePipes(new ZodValidationPipe(CreateReportZodDto))
  @ApiBody({ type: CreateReportZodDto })
  async createReport(@Body() data: CreateReportZodDto, @Req() req: any) {
    const userId = req.user?.id || null; // Might need loose extraction or explicit route
    return this.reportsService.createReport(data as any, userId);
  }

  @Get('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: '신고 목록 조회 (관리자)' })
  async getReports(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('targetType') targetType?: string,
  ) {
    return this.reportsService.getReports(Number(page), Number(limit), status, targetType);
  }

  @Patch('admin/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe(ResolveReportZodDto))
  @ApiBody({ type: ResolveReportZodDto })
  @ApiOperation({ summary: '신고 처리 상태 변경 (관리자)' })
  async resolveReport(
    @Param('id') id: string,
    @Body() data: ResolveReportZodDto,
    @Req() req: any,
  ) {
    return this.reportsService.resolveReport(id, req.user.id, data as any);
  }
}
