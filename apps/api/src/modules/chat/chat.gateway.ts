import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
import {
  CHAT_EVENTS,
  CHAT_SOCKET_NAMESPACE,
  ErrorCode,
  ErrorMessages,
  REALTIME_EVENTS,
} from '@community/shared-types';
import type {
  ChatMessage,
  ChatDeletePayload,
  ChatErrorPayload,
  ChatJoinPayload,
  ChatSendPayload,
} from '@community/shared-types';
import {
  ChatDomainError,
  ChatIdentity,
  ChatService,
  isChatDomainError,
} from './chat.service';
import { PRESENCE_TOUCH_INTERVAL_MS } from './chat.constants';
import { pickForwardedIp } from '../../common/utils/client-ip';
import { RealtimeService } from '../realtime/realtime.service';

type ChatSocket = Socket & {
  data: {
    identity: ChatIdentity | null;
    room: string | null;
    ip: string;
  };
};

@WebSocketGateway({
  namespace: CHAT_SOCKET_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(ChatGateway.name);
  private presenceTimer: NodeJS.Timeout | null = null;

  private unsubAvailability: (() => void) | null = null;

  constructor(
    private readonly chatService: ChatService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit() {
    this.unsubAvailability = this.chatService.onAvailabilityChange((available) => {
      this.handleAvailabilityChange(available);
    });
    this.presenceTimer = setInterval(() => {
      this.refreshLocalPresence().catch((err) => {
        this.logger.warn(`presence refresh failed: ${err?.message ?? err}`);
      });
    }, PRESENCE_TOUCH_INTERVAL_MS);
  }

  onModuleDestroy() {
    this.unsubAvailability?.();
    this.unsubAvailability = null;
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  async handleConnection(client: ChatSocket) {
    const ip = this.extractIp(client);
    client.data.ip = ip;
    client.data.room = null;

    if (!this.chatService.isFeatureEnabled()) {
      this.emitError(client, ErrorCode.CHAT_UNAVAILABLE);
      client.disconnect(true);
      return;
    }

    const allowed = await this.chatService.acquireConnection(ip);
    if (!allowed) {
      this.emitError(client, ErrorCode.TOO_MANY_REQUESTS);
      client.disconnect(true);
      return;
    }

    try {
      client.data.identity = await this.chatService.resolveHandshake({
        cookieHeader: client.handshake.headers.cookie,
        guestToken: this.readGuestToken(client),
      });
    } catch {
      client.data.identity = null;
    }
  }

  async handleDisconnect(client: ChatSocket) {
    const room = client.data.room;
    if (room) {
      const count = await this.chatService.leavePresence(room, client.id);
      this.server.to(room).emit(CHAT_EVENTS.ONLINE, { room, count });
    }
    if (client.data.ip) {
      await this.chatService.releaseConnection(client.data.ip);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.JOIN)
  async handleJoin(@ConnectedSocket() client: ChatSocket, @MessageBody() body: ChatJoinPayload) {
    try {
      this.chatService.assertLive();
      const room = this.chatService.normalizeRoom(body?.room);

      if (client.data.room && client.data.room !== room) {
        client.leave(client.data.room);
        await this.chatService.leavePresence(client.data.room, client.id);
      }

      client.join(room);
      client.data.room = room;
      const onlineCount = await this.chatService.joinPresence(room, client.id);
      const messages = await this.chatService.getRecentMessages(room);
      const identity = client.data.identity;

      client.emit(CHAT_EVENTS.HISTORY, { room, messages });
      client.emit(CHAT_EVENTS.JOINED, {
        room,
        role: identity?.kind ?? 'spectator',
        nickname: identity?.nickname ?? null,
        onlineCount,
        userId: identity?.kind === 'member' ? identity.userId : null,
        guestId: identity?.kind === 'guest' ? identity.guestId : null,
      });
      this.server.to(room).emit(CHAT_EVENTS.ONLINE, { room, count: onlineCount });
    } catch (error) {
      if (client.data.room) {
        client.leave(client.data.room);
        client.data.room = null;
      }
      this.handleSocketError(client, error);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.SEND)
  async handleSend(@ConnectedSocket() client: ChatSocket, @MessageBody() body: ChatSendPayload) {
    try {
      this.chatService.assertLive();
      if (!client.data.room) {
        throw new ChatDomainError(ErrorCode.CHAT_UNAUTHORIZED, '채팅방에 입장한 후 메시지를 보낼 수 있습니다.');
      }
      const room = client.data.room;
      const identity = await this.chatService.assertCanSend(client.data.identity);
      client.data.identity = identity;

      const message = await this.chatService.sendMessage(
        identity,
        body?.content ?? '',
        room,
        body?.replyToId,
      );
      await this.publishMessage(room, message);
    } catch (error) {
      this.handleSocketError(client, error);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.DELETE)
  async handleDelete(@ConnectedSocket() client: ChatSocket, @MessageBody() body: ChatDeletePayload) {
    try {
      this.chatService.assertLive();
      if (!client.data.room) {
        throw new ChatDomainError(ErrorCode.CHAT_UNAUTHORIZED, '채팅방에 입장한 후 메시지를 삭제할 수 있습니다.');
      }
      const room = client.data.room;
      const identity = await this.chatService.assertCanSend(client.data.identity);
      client.data.identity = identity;

      const result = await this.chatService.deleteMessage(identity, body?.id ?? '', room);
      await this.publishMessageDeleted(room, result);
    } catch (error) {
      this.handleSocketError(client, error);
    }
  }

  private handleAvailabilityChange(available: boolean) {
    if (!this.server) return;
    if (available) {
      for (const socket of this.server.sockets.values()) {
        socket.emit(CHAT_EVENTS.AVAILABLE);
      }
      return;
    }
    for (const socket of this.server.sockets.values()) {
      const client = socket as ChatSocket;
      if (client.data.room) {
        client.leave(client.data.room);
        client.data.room = null;
      }
      this.emitError(client, ErrorCode.CHAT_UNAVAILABLE);
      if (!this.chatService.isFeatureEnabled()) {
        client.disconnect(true);
      }
    }
  }

  private async refreshLocalPresence() {
    if (!this.server) return;
    for (const socket of this.server.sockets.values()) {
      const room = (socket.data as ChatSocket['data']).room;
      if (room) {
        await this.chatService.touchPresence(room, socket.id);
      }
    }
  }

  /*
   * 채팅방의 모든 사람에게 알린다: 이 서버에 웹소켓으로 연결된 사람과, Supabase Realtime 채널을 듣는 사람 모두.
   * (Supabase로 바꾸는 배포 중에는 예전 화면(웹소켓)과 새 화면(Realtime)이 섞여 있어도 서로의 메시지가 보이도록 양쪽에 보낸다)
   */
  async publishMessage(room: string, message: ChatMessage) {
    this.server?.to(room).emit(CHAT_EVENTS.MESSAGE, message);
    await this.realtime.broadcast(this.realtime.chatTopic(room), REALTIME_EVENTS.CHAT_MESSAGE, { ...message });
  }

  async publishMessageDeleted(room: string, result: { room: string; id: string }) {
    this.server?.to(room).emit(CHAT_EVENTS.MESSAGE_DELETED, result);
    await this.realtime.broadcast(this.realtime.chatTopic(room), REALTIME_EVENTS.CHAT_MESSAGE_DELETED, result);
  }

  async broadcastHistoryClear(room: string) {
    this.server?.to(room).emit(CHAT_EVENTS.HISTORY, { room, messages: [] });
    await this.realtime.broadcast(this.realtime.chatTopic(room), REALTIME_EVENTS.CHAT_HISTORY_CLEARED, { room });
  }

  private readGuestToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { guestToken?: string } | undefined;
    if (auth?.guestToken) return auth.guestToken;
    const header = client.handshake.headers['x-guest-token'];
    if (typeof header === 'string') return header;
    const query = client.handshake.query?.guestToken;
    if (typeof query === 'string') return query;
    return undefined;
  }

  private extractIp(client: Socket): string {
    const forwarded = client.handshake.headers['x-forwarded-for'];
    // 맨 앞 값은 사용자가 꾸며 보낼 수 있으므로 앞단 프록시가 덧붙인 값만 사용
    return (
      pickForwardedIp(
        typeof forwarded === 'string' ? forwarded : undefined,
        client.handshake.address,
      ) || 'unknown'
    );
  }

  private handleSocketError(client: Socket, error: unknown) {
    if (isChatDomainError(error)) {
      this.emitError(client, error.errorCode, error.message);
      return;
    }
    this.logger.warn(`socket error: ${error instanceof Error ? error.message : String(error)}`);
    this.emitError(client, ErrorCode.INTERNAL_SERVER_ERROR);
  }

  private emitError(client: Socket, code: ErrorCode, message?: string) {
    const payload: ChatErrorPayload = {
      code,
      message: message || ErrorMessages[code],
    };
    client.emit(CHAT_EVENTS.ERROR, payload);
  }
}
