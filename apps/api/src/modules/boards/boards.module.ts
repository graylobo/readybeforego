import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { BoardsRepository } from './boards.repository';
import { BoardManagersService } from './board-managers.service';
import { BoardRequestsService } from './board-requests.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [BoardsController],
  providers: [BoardsService, BoardsRepository, BoardManagersService, BoardRequestsService],
  exports: [BoardsService, BoardsRepository, BoardManagersService],
})
export class BoardsModule {}
