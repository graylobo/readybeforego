import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import Redis from 'ioredis';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService implements OnModuleDestroy {
  // 특정 사용자의 활성 스트림 맵 (동일 사용자 멀티 탭 연결 지원을 위해 Subject 배열로 관리)
  private readonly userStreams = new Map<string, Subject<any>[]>();

  constructor(
    private readonly notificationsRepo: NotificationsRepository,
    @Inject('REDIS_PUBLISHER') private readonly redisPublisher: Redis,
    @Inject('REDIS_SUBSCRIBER') private readonly redisSubscriber: Redis,
  ) {
    this.initRedisSubscription();
  }

  /**
   * 단 하나의 전용 Redis Subscriber 커넥션으로 전체 서버 노드의 유저 알림 이벤트를 일괄 수신 및 매핑 브로드캐스트합니다.
   * 이를 통해 CCU가 급증하더라도 Redis 커넥션을 극도로 보존하며 분산 서버 스케일아웃을 지원합니다.
   */
  private initRedisSubscription() {
    this.redisSubscriber.psubscribe('notification:user:*');

    this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
      try {
        // channel format: notification:user:{userId}
        const parts = channel.split(':');
        const userId = parts[parts.length - 1];

        if (userId && this.userStreams.has(userId)) {
          const data = JSON.parse(message);
          const streams = this.userStreams.get(userId);
          if (streams) {
            streams.forEach((stream) => stream.next(data));
          }
        }
      } catch (err: any) {
        // 예외 무시 및 안전 복구
      }
    });
  }

  async create(data: {
    userId: string;
    actorId?: string;
    type: 'COMMENT' | 'REPLY' | 'LIKE' | 'SYSTEM' | 'MESSAGE';
    content: string;
    targetId?: string;
    targetType?: 'POST' | 'COMMENT' | 'MESSAGE';
    link?: string;
  }) {
    // Avoid duplicate notifications from the same actor for the same target/type
    if (data.actorId && data.targetId && data.type === 'LIKE') {
      const existing = await this.notificationsRepo.findDuplicateNotification(data);

      if (existing) {
        return [existing];
      }
    }

    const created = await this.notificationsRepo.insertNotification(data);
    
    if (created && created[0]) {
      // 🚀 Drizzle DB 저장 성공 시 Redis Pub/Sub을 통해 모든 분산 서버 인스턴스로 실시간 이벤트 전송!
      const channel = `notification:user:${data.userId}`;
      await this.redisPublisher.publish(channel, JSON.stringify(created[0]));
    }

    return created;
  }

  /**
   * 특정 유저가 연결한 SSE 개별 채널을 구독하고, Observable을 리턴합니다.
   */
  subscribeUser(userId: string): Observable<any> {
    const userStream = new Subject<any>();

    let streams = this.userStreams.get(userId);
    if (!streams) {
      streams = [];
      this.userStreams.set(userId, streams);
    }
    streams.push(userStream);

    // 컴포넌트 언마운트 또는 SSE 커넥션 유실 시 스트림을 완벽히 정리(Cleanup)하여 메모리 누수를 원천 차단합니다.
    return new Observable<any>((observer) => {
      const subscription = userStream.subscribe({
        next: (data) => observer.next(data),
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });

      return () => {
        subscription.unsubscribe();
        const streams = this.userStreams.get(userId);
        if (streams) {
          const index = streams.indexOf(userStream);
          if (index > -1) {
            streams.splice(index, 1);
          }
          if (streams.length === 0) {
            this.userStreams.delete(userId);
          }
        }
      };
    });
  }

  /**
   * 지하철 음영 지역 등으로 인한 네트워크 단절 시, 끊겼던 순간 사이에 유실된 미수신 알림 데이터를 DB에서 백필(Backfill)합니다.
   */
  async getMissedNotifications(userId: string, lastEventId: string) {
    try {
      const parsedTime = Date.parse(lastEventId);

      // 1. 만약 Last-Event-ID 가 타임스탬프인 경우 시간 조건으로 직접 DB 범위 조회
      if (!isNaN(parsedTime)) {
        const sinceDate = new Date(parsedTime);
        return await this.notificationsRepo.findNotificationsSince(userId, sinceDate);
      }
    } catch (err) {
      // 복구 실패 시 안전을 위해 빈 배열 리턴
    }
    return [];
  }

  async findAll(userId: string) {
    return await this.notificationsRepo.findAllNotifications(userId);
  }

  async getUnreadCount(userId: string) {
    return await this.notificationsRepo.countUnread(userId);
  }

  async markAsRead(id: string, userId: string) {
    return await this.notificationsRepo.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return await this.notificationsRepo.markAllAsRead(userId);
  }

  async remove(id: string, userId: string) {
    return await this.notificationsRepo.deleteNotification(id, userId);
  }

  async removeAll(userId: string) {
    return await this.notificationsRepo.deleteAllNotifications(userId);
  }

  onModuleDestroy() {
    this.redisSubscriber.punsubscribe('notification:user:*');
  }
}
