import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type { RealtimeConfig } from '@community/shared-types';

// 서버에서 채널로 보내는 요청이 늦어지면 채팅 전송 응답이 같이 늦어지므로 짧게 끊는다
const BROADCAST_TIMEOUT_MS = 5_000;

/**
 * Supabase Realtime 연결.
 * 실시간 연결(채팅 창, 알림)을 API 서버가 직접 들고 있으면 연결이 열려 있는 동안 Cloud Run이 계속 과금된다.
 * REALTIME_PROVIDER=supabase이면 브라우저는 Supabase Realtime 채널을 듣고, 이 서버는 보낼 때만 짧은 요청을 보낸다.
 *
 * 채널 권한은 DB의 realtime.messages RLS 정책으로 정한다 (scripts/supabase-realtime.sql):
 * 방문자(anon)는 chat:·notify: 채널을 받기만 하고(채팅은 접속자 표시만 허용), 메시지는 이 서버(service_role)만 보낸다.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly enabled: boolean;
  private readonly restUrl: string;
  private readonly socketUrl: string;
  private readonly anonKey: string;
  private readonly serviceKey: string;

  constructor(config: ConfigService) {
    const supabaseUrl = (config.get<string>('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    this.anonKey = config.get<string>('SUPABASE_ANON_KEY') ?? '';
    this.serviceKey = config.get<string>('SUPABASE_SERVICE_KEY') ?? '';
    // 자체 호스팅 Realtime처럼 주소가 다르면 따로 지정 (기본은 Supabase 프로젝트의 /realtime/v1)
    this.restUrl = (config.get<string>('SUPABASE_REALTIME_URL') || `${supabaseUrl}/realtime/v1`).replace(/\/+$/, '');
    this.socketUrl = (config.get<string>('SUPABASE_REALTIME_SOCKET_URL') || this.restUrl).replace(/^http/, 'ws');

    const wanted = config.get<string>('REALTIME_PROVIDER') === 'supabase';
    this.enabled = wanted && !!supabaseUrl && !!this.anonKey && !!this.serviceKey;
    if (wanted && !this.enabled) {
      this.logger.warn('REALTIME_PROVIDER=supabase but SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY is missing — using the API server connection instead');
    }
  }

  isEnabled() {
    return this.enabled;
  }

  /** 브라우저가 쓸 접속 정보 (anon 키는 원래 공개되는 값) */
  publicConfig(): RealtimeConfig {
    if (!this.enabled) return { provider: 'server' };
    return { provider: 'supabase', url: this.socketUrl, anonKey: this.anonKey };
  }

  /** 채팅방 채널 이름 */
  chatTopic(room: string) {
    return `chat:${room}`;
  }

  /**
   * 회원 한 명의 알림 채널 이름. 회원 id를 그대로 쓰면 남의 알림 신호를 엿들을 수 있으므로,
   * 서버만 아는 키로 만든 값을 쓰고 본인에게만 알려준다 (GET /notifications/realtime)
   */
  notificationTopic(userId: string) {
    const digest = createHmac('sha256', this.serviceKey).update(`notify:${userId}`).digest('base64url').slice(0, 32);
    return `notify:${digest}`;
  }

  /**
   * 채널의 모든 구독자에게 보낸다. 실패해도 예외를 던지지 않는다
   * (메시지는 이미 저장됐고, 화면은 다시 연결하거나 새로고침하면 최근 기록에서 받는다)
   */
  async broadcast(topic: string, event: string, payload: Record<string, unknown>) {
    if (!this.enabled) return;
    // 새 형식 키(sb_secret_…)는 JWT가 아니라서 apikey 머리말로만 보낸다
    const headers: Record<string, string> = { 'content-type': 'application/json', apikey: this.serviceKey };
    if (!this.serviceKey.startsWith('sb_')) headers.authorization = `Bearer ${this.serviceKey}`;
    try {
      const res = await fetch(`${this.restUrl}/api/broadcast`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [{ topic, event, payload, private: true }] }),
        signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`broadcast ${topic}/${event} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      }
    } catch (err) {
      this.logger.warn(`broadcast ${topic}/${event} failed: ${(err as Error)?.message}`);
    }
  }
}
