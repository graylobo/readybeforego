import { USER_ROLES } from '@community/shared-types';
import { Body, Controller, Get, Patch, UseGuards, UsePipes, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ClearCacheInterceptor } from '../../common/interceptors/clear-cache.interceptor';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UpdateSiteSettingsZodDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @ApiOperation({ summary: '사이트 전역 설정 조회' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  // 바꾼 설정이 바로 보이도록 조회 응답 캐시를 지운다 (예전에는 지우지 않아 최대 60초 옛 설정이 보였다)
  @UseInterceptors(ClearCacheInterceptor('/settings'))
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe(UpdateSiteSettingsZodDto))
  @ApiBody({ type: UpdateSiteSettingsZodDto })
  @ApiOperation({ summary: '사이트 전역 설정 업데이트 (관리자 전용)' })
  async updateSettings(@Body() data: UpdateSiteSettingsZodDto) {
    return this.settingsService.updateSettings(data);
  }
}
