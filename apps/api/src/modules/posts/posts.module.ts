import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsRepository } from './posts.repository';
import { PostsController } from './posts.controller';
import { BoardPurgeController } from './board-purge.controller';
import { BoardsModule } from '../boards/boards.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [BoardsModule, UploadsModule, PointsModule],
  controllers: [PostsController, BoardPurgeController],
  providers: [PostsService, PostsRepository],
  exports: [PostsService, PostsRepository],
})
export class PostsModule {}
