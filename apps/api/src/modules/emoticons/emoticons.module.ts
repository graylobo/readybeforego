import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { EmoticonsController } from './emoticons.controller';
import { EmoticonsRepository } from './emoticons.repository';
import { EmoticonsService } from './emoticons.service';

@Module({
  imports: [PointsModule],
  controllers: [EmoticonsController],
  providers: [EmoticonsService, EmoticonsRepository],
  exports: [EmoticonsService],
})
export class EmoticonsModule {}
