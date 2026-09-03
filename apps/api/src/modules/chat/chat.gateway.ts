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
} from '@community/shared-types';
import type {
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

  constructor(private readonly chatService: ChatService) {}

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
      this.server.to(room).emit(CHAT_EVENTS.MESSAGE, message);
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

  broadcastHistoryClear(room: string) {
    if (!this.server) return;
    this.server.to(room).emit(CHAT_EVENTS.HISTORY, { room, messages: [] });
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
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return client.handshake.address || 'unknown';
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
