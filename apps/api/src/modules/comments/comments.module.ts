import { Module, forwardRef } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsRepository } from './comments.repository';
import { CommentsController } from './comments.controller';
import { BoardsModule } from '../boards/boards.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PostsModule } from '../posts/posts.module';
import { PointsModule } from '../points/points.module';
import { LogsModule } from '../logs/logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => BoardsModule),
    forwardRef(() => PostsModule),
    PointsModule,
    LogsModule,
    NotificationsModule,
    UploadsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
  exports: [CommentsService, CommentsRepository],
})
export class CommentsModule {}
