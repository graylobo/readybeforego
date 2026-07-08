import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PointsService } from './points.service';

@ApiTags('points')
@Controller('points')
@UseGuards(AuthGuard('jwt'))
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('me')
  async getMyPoints(@Req() req: any) {
    return this.pointsService.getMyPoints(req.user.id);
  }

  @Get('history')
  async getMyHistory(@Req() req: any) {
    return this.pointsService.getHistory(req.user.id);
  }
}
