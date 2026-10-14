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
import { COMMENT_TARGET_CLASSES, commentTargetProviders } from './targets';

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
  providers: [CommentsService, CommentsRepository, ...commentTargetProviders(COMMENT_TARGET_CLASSES)],
  exports: [CommentsService, CommentsRepository],
})
export class CommentsModule {}
