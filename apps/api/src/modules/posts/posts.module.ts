import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsRepository } from './posts.repository';
import { PostsController } from './posts.controller';
import { BoardsModule } from '../boards/boards.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [BoardsModule, UploadsModule, PointsModule],
  controllers: [PostsController],
  providers: [PostsService, PostsRepository],
  exports: [PostsService, PostsRepository],
})
export class PostsModule {}
