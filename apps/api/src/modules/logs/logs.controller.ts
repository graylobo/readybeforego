import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('logs')
@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('me')
  async getMyLogs(@Req() req: any) {
    const userId = req.user.id;
    return this.logsService.findByUser(userId);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getAllLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.logsService.findAll(parseInt(page), parseInt(limit));
  }
}
