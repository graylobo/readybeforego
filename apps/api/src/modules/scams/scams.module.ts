import { Module } from '@nestjs/common';
import { ScamsController } from './scams.controller';
import { ScamsService } from './scams.service';
import { ScamsRepository } from './scams.repository';

@Module({
  controllers: [ScamsController],
  providers: [ScamsService, ScamsRepository],
  exports: [ScamsService, ScamsRepository],
})
export class ScamsModule {}
