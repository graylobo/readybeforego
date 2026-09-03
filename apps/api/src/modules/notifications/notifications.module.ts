import { Global, Module, forwardRef } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsRepository } from './notifications.repository';
import { PostsModule } from '../posts/posts.module';
import { CommentsModule } from '../comments/comments.module';

@Global()
@Module({
  imports: [
    RedisModule,
    forwardRef(() => PostsModule),
    forwardRef(() => CommentsModule),
  ],
  providers: [
    NotificationsService,
    NotificationsListener,
    NotificationsRepository,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
