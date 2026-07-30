import { Controller, Get, Post, Delete, Param, UseGuards, Req, Sse, MessageEvent, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.notificationsService.findAll(req.user.id);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.remove(id, req.user.id);
  }

  @Delete()
  async removeAll(@Req() req: any) {
    return this.notificationsService.removeAll(req.user.id);
  }

  @Sse('sse')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  async sse(@Req() req: any): Promise<Observable<MessageEvent>> {
    const userId = req.user.id;
    
    // HTTP/1.1 커넥션 제한 및 네트워크 재연결 시 누락된 이벤트를 추적하기 위한 Last-Event-ID 헤더/쿼리 파악
    const lastEventId = req.headers['last-event-id'] || req.query['lastEventId'];
    
    // 1. 끊어져 있던 순간 동안 누락된 알림 복구 (Backfill)
    let missedEvents: any[] = [];
    if (lastEventId) {
      missedEvents = await this.notificationsService.getMissedNotifications(userId, String(lastEventId));
    }

    // 2. 실시간 SSE 라이브 스트림 연결 (실제 알림 이벤트가 발송될 때만 데이터 전송)
    const liveStream = this.notificationsService.subscribeUser(userId).pipe(
      map((notification) => ({
        data: notification,
        id: notification.createdAt ? new Date(notification.createdAt).getTime().toString() : notification.id,
      } as MessageEvent))
    );

    // 3. 누락된 이벤트가 존재할 시, 라이브 스트림 맨 앞에 순차 정렬하여 주입
    if (missedEvents && missedEvents.length > 0) {
      const { of, concat } = require('rxjs');
      
      const missedObservable = of(
        ...missedEvents.reverse().map((notification) => ({
          data: notification,
          id: notification.createdAt ? new Date(notification.createdAt).getTime().toString() : notification.id,
        } as MessageEvent))
      );

      return concat(missedObservable, liveStream);
    }

    return liveStream;
  }
}
