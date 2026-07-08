import { USER_ROLES } from '@community/shared-types';
import { Body, Controller, Get, Patch, UseGuards, UsePipes, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe(UpdateSiteSettingsZodDto))
  @ApiBody({ type: UpdateSiteSettingsZodDto })
  @ApiOperation({ summary: '사이트 전역 설정 업데이트 (관리자 전용)' })
  async updateSettings(@Body() data: UpdateSiteSettingsZodDto) {
    return this.settingsService.updateSettings(data);
  }
}
