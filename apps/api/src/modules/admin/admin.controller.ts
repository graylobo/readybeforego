import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { USER_ROLES } from '@community/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { 
    BanUserZodDto, 
    ReactivateUserZodDto, 
    SuspendUserZodDto, 
    UpdatePointPolicyZodDto, 
    UpdateUserRoleZodDto, 
    WarnUserZodDto 
} from '../../common/dto/zod-dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from '../users/users.service';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(USER_ROLES.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: '사용자 목록 조회 (관리자)' })
  async getUsers(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  @Get('users/:id/moderation-logs')
  @ApiOperation({ summary: '사용자 제재 내역 조회 (관리자)' })
  async getModerationLogs(@Param('id') id: string) {
    return this.adminService.getModerationLogs(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '사용자 권한 변경 (시스템 관리자)' })
  @ApiBody({ type: UpdateUserRoleZodDto })
  @Roles(USER_ROLES.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe(UpdateUserRoleZodDto))
  async updateUserRole(@Param('id') id: string, @Body() data: UpdateUserRoleZodDto) {
    return this.usersService.update(id, { role: data.role as any });
  }

  @Get('dashboard')
  @ApiOperation({ summary: '관리자 대시보드 통계' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Post('users/:id/warn')
  @ApiOperation({ summary: '사용자 경고 부여' })
  @ApiBody({ type: WarnUserZodDto })
  @UsePipes(new ZodValidationPipe(WarnUserZodDto))
  async warnUser(@Param('id') id: string, @Body() data: WarnUserZodDto, @Req() req: any) {
    return this.adminService.warnUser(req.user.id, id, data.reason);
  }

  @Post('users/:id/suspend')
  @ApiOperation({ summary: '사용자 활동 정지' })
  @ApiBody({ type: SuspendUserZodDto })
  @UsePipes(new ZodValidationPipe(SuspendUserZodDto))
  async suspendUser(@Param('id') id: string, @Body() data: SuspendUserZodDto, @Req() req: any) {
    return this.adminService.suspendUser(req.user.id, id, data.reason, data.days);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: '사용자 영구 정지' })
  @ApiBody({ type: BanUserZodDto })
  @UsePipes(new ZodValidationPipe(BanUserZodDto))
  async banUser(@Param('id') id: string, @Body() data: BanUserZodDto, @Req() req: any) {
    return this.adminService.banUser(req.user.id, id, data.reason);
  }

  @Post('users/:id/reactivate')
  @ApiOperation({ summary: '사용자 계정 활성화' })
  @ApiBody({ type: ReactivateUserZodDto })
  @UsePipes(new ZodValidationPipe(ReactivateUserZodDto))
  async reactivateUser(@Param('id') id: string, @Body() data: ReactivateUserZodDto, @Req() req: any) {
    return this.adminService.reactivateUser(req.user.id, id, data.reason);
  }

  @Get('points/policies')
  @ApiOperation({ summary: '포인트 정책 조회' })
  async getPointPolicies() {
    return this.adminService.getPointPolicies();
  }

  @Patch('points/policies/:id')
  @ApiOperation({ summary: '포인트 정책 수정' })
  @ApiBody({ type: UpdatePointPolicyZodDto })
  @UsePipes(new ZodValidationPipe(UpdatePointPolicyZodDto))
  async updatePointPolicy(
    @Param('id') id: string,
    @Body() data: UpdatePointPolicyZodDto
  ) {
    return this.adminService.updatePointPolicy(id, data);
  }
}
