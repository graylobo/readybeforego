import { Module } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { PointsListener } from './points.listener';
import { PointsRepository } from './points.repository';

@Module({
  controllers: [PointsController],
  providers: [PointsService, PointsListener, PointsRepository],
  exports: [PointsService, PointsRepository],
})
export class PointsModule {}
