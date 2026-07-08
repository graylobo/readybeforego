import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { BoardsRepository } from './boards.repository';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, BoardsRepository],
  exports: [BoardsService, BoardsRepository],
})
export class BoardsModule {}
