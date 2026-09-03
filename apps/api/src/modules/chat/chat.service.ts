import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import {
  CHAT_LIMITS,
  CHAT_ROOM_DEFAULT,
  ChatGuestClaimResponse,
  ChatMessage,
  ChatReplyTo,
  ClaimGuestNicknameSchema,
  ErrorCode,
  ErrorMessages,
  GUEST_NICKNAME_REGEX,
} from '@community/shared-types';
import { UsersService } from '../users/users.service';
import { REDIS_PUBLISHER } from '../redis/redis.constants';
import { ChatRepository } from './chat.repository';
import { ChatSettingsService } from './chat-settings.service';
import {
  CHAT_PERSIST_QUEUE,
  CHAT_REDIS_KEYS,
  GUEST_TOKEN_EXPIRES_SECONDS,
  PRESENCE_TTL_MS,
  REDIS_HEALTH_INTERVAL_MS,
} from './chat.constants';
import { sanitizePlainText } from '../../common/utils/html-sanitizer';

export type ChatIdentity =
  | { kind: 'member'; userId: string; nickname: string; status: string }
  | { kind: 'guest'; guestId: string; nickname: string };

export class ChatDomainError extends Error {
  constructor(
    public readonly errorCode: ErrorCode,
    message?: string,
  ) {
    super(message || ErrorMessages[errorCode]);
    this.name = 'ChatDomainError';
  }
}

interface GuestJwtPayload {
  typ?: string;
  nick?: string;
  gid?: string;
  sub?: string;
}

@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  private redisReady = false;
  private featureEnabled = true;
  private lastEmittedAvailable: boolean | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private probing = false;
  private readonly availabilityListeners = new Set<(available: boolean) => void>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly chatRepo: ChatRepository,
    @InjectQueue(CHAT_PERSIST_QUEUE) private readonly persistQueue: Queue,
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    private readonly chatSettings: ChatSettingsService,
  ) {
    this.syncLiveFromStatus();
    this.redis.on('ready', () => this.setLive(true));
    this.redis.on('reconnecting', () => this.setLive(false));
    this.redis.on('end', () => this.setLive(false));
    this.redis.on('close', () => this.syncLiveFromStatus());
    this.redis.on('error', () => this.syncLiveFromStatus());

    this.healthTimer = setInterval(() => {
      void this.probeRedis();
    }, REDIS_HEALTH_INTERVAL_MS);
    this.healthTimer.unref?.();
    void this.refreshFeatureFlag();
  }

  onModuleDestroy() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    this.availabilityListeners.clear();
  }

  isLive(): boolean {
    return this.redisReady;
  }

  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  isAccepting(): boolean {
    return this.redisReady && this.featureEnabled;
  }

  assertLive(): void {
    this.assertAccepting();
  }

  assertAccepting(): void {
    if (!this.isAccepting()) {
      throw new ChatDomainError(ErrorCode.CHAT_UNAVAILABLE);
    }
  }

  onAvailabilityChange(listener: (available: boolean) => void): () => void {
    this.availabilityListeners.add(listener);
    return () => this.availabilityListeners.delete(listener);
  }

  normalizeRoom(room?: string): string {
    const slug = (room || CHAT_ROOM_DEFAULT).trim().toLowerCase();
    if (slug !== CHAT_ROOM_DEFAULT) {
      throw new ChatDomainError(ErrorCode.INVALID_INPUT, '존재하지 않는 채팅방입니다.');
    }
    return slug;
  }

  async claimGuestNickname(nickname: string): Promise<ChatGuestClaimResponse> {
    if (!(await this.chatSettings.isEnabled())) {
      throw new ChatDomainError(ErrorCode.CHAT_UNAVAILABLE);
    }
    const parsed = ClaimGuestNicknameSchema.safeParse({ nickname });
    if (!parsed.success) {
      throw new ChatDomainError(ErrorCode.CHAT_NICKNAME_INVALID);
    }

    const normalized = parsed.data.nickname;
    const taken = await this.usersService.isNameTaken(normalized);
    if (taken) {
      throw new ChatDomainError(ErrorCode.CHAT_NICKNAME_TAKEN);
    }

    const guestId = randomUUID();
    const token = this.jwtService.sign(
      { typ: 'guest', nick: normalized, gid: guestId },
      { expiresIn: CHAT_LIMITS.GUEST_TOKEN_EXPIRES_IN },
    );

    return {
      token,
      nickname: normalized,
      guestId,
      expiresIn: GUEST_TOKEN_EXPIRES_SECONDS,
    };
  }

  async getRecentMessages(room = CHAT_ROOM_DEFAULT, limit: number = CHAT_LIMITS.HISTORY_DEFAULT): Promise<ChatMessage[]> {
    this.assertLive();
    const slug = this.normalizeRoom(room);
    const safeLimit = Math.min(Math.max(limit, 1), CHAT_LIMITS.HISTORY_MAX);

    const cached = await this.readRecentCache(slug, safeLimit);
    if (cached.length > 0) {
      return cached;
    }

    if (!(await this.chatSettings.isPersistEnabled())) {
      return [];
    }

    const rows = await this.chatRepo.findRecent(slug, safeLimit);
    const messages = rows
      .map((row) => this.toChatMessage(row))
      .reverse();

    if (messages.length > 0) {
      await this.backfillRecentCache(slug, messages);
    }

    return messages;
  }

  async getOnlineCount(room = CHAT_ROOM_DEFAULT): Promise<number> {
    this.assertLive();
    const slug = this.normalizeRoom(room);
    return this.countPresence(slug);
  }

  async clearHistory(room = CHAT_ROOM_DEFAULT): Promise<{ room: string; deletedCount: number }> {
    const slug = this.normalizeRoom(room);

    try {
      if (this.redisReady) {
        await this.redis.del(CHAT_REDIS_KEYS.recent(slug));
      }
    } catch (error) {
      this.logger.warn(
        `chat recent cache clear skipped: ${error instanceof Error ? error.message : error}`,
      );
    }

    const deletedCount = await this.chatRepo.deleteByRoom(slug);
    return { room: slug, deletedCount };
  }

  async resolveHandshake(params: {
    cookieHeader?: string;
    guestToken?: string;
  }): Promise<ChatIdentity | null> {
    const memberToken = this.extractCookie(params.cookieHeader, 'access_token');
    if (memberToken) {
      const member = await this.verifyMemberToken(memberToken);
      if (member) return member;
    }

    if (params.guestToken) {
      return this.verifyGuestToken(params.guestToken);
    }

    return null;
  }

  async assertCanSend(identity: ChatIdentity | null): Promise<ChatIdentity> {
    if (!identity) {
      throw new ChatDomainError(ErrorCode.CHAT_UNAUTHORIZED);
    }

    if (identity.kind === 'member') {
      if (identity.status === 'banned') {
        throw new ChatDomainError(ErrorCode.CHAT_FORBIDDEN);
      }
      if (identity.status === 'suspended') {
        throw new ChatDomainError(ErrorCode.CHAT_FORBIDDEN);
      }
      return identity;
    }

    const taken = await this.usersService.isNameTaken(identity.nickname);
    if (taken) {
      throw new ChatDomainError(ErrorCode.CHAT_NICKNAME_TAKEN);
    }

    return identity;
  }

  async sendMessage(
    identity: ChatIdentity,
    rawContent: string,
    room?: string,
    replyToId?: string,
  ): Promise<ChatMessage> {
    this.assertLive();
    const slug = this.normalizeRoom(room);
    await this.assertCanSend(identity);

    const identityKey = identity.kind === 'member' ? `m:${identity.userId}` : `g:${identity.guestId}`;
    const allowed = await this.consumeRateLimit(identityKey);
    if (!allowed) {
      throw new ChatDomainError(ErrorCode.CHAT_RATE_LIMITED);
    }

    const content = sanitizePlainText(rawContent);
    if (!content) {
      throw new ChatDomainError(ErrorCode.CHAT_MESSAGE_INVALID);
    }
    if (content.length > CHAT_LIMITS.MESSAGE_MAX) {
      throw new ChatDomainError(ErrorCode.CHAT_MESSAGE_INVALID);
    }

    const replyTo = await this.resolveReplyTo(slug, replyToId);

    const message: ChatMessage = {
      id: randomUUID(),
      roomSlug: slug,
      authorType: identity.kind,
      userId: identity.kind === 'member' ? identity.userId : null,
      guestId: identity.kind === 'guest' ? identity.guestId : null,
      nickname: identity.nickname,
      content,
      createdAt: new Date().toISOString(),
      replyTo,
    };

    await this.pushRecentCache(slug, message);
    await this.enqueuePersist(message);

    return message;
  }

  async acquireConnection(ip: string): Promise<boolean> {
    if (!this.redisReady) {
      return true;
    }
    const key = CHAT_REDIS_KEYS.ipConn(ip);
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 60 * 60);
      }
      if (count > CHAT_LIMITS.MAX_CONNECTIONS_PER_IP) {
        await this.redis.decr(key);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.debug(`chat ip cap skipped: ${error instanceof Error ? error.message : error}`);
      return true;
    }
  }

  async releaseConnection(ip: string): Promise<void> {
    if (!this.redisReady) return;
    try {
      const key = CHAT_REDIS_KEYS.ipConn(ip);
      const count = await this.redis.decr(key);
      if (count <= 0) {
        await this.redis.del(key);
      }
    } catch {
      // Redis가 내려간 뒤의 disconnect 정리는 생략한다.
    }
  }

  async joinPresence(room: string, socketId: string): Promise<number> {
    const now = Date.now();
    return this.withRedis(async () => {
      const key = CHAT_REDIS_KEYS.presence(room);
      await this.redis.zadd(key, now, socketId);
      await this.redis.zremrangebyscore(key, 0, now - PRESENCE_TTL_MS);
      return await this.redis.zcard(key);
    });
  }

  async leavePresence(room: string, socketId: string): Promise<number> {
    if (!this.redisReady) return 0;
    try {
      return await this.withRedis(async () => {
        const key = CHAT_REDIS_KEYS.presence(room);
        await this.redis.zrem(key, socketId);
        await this.redis.zremrangebyscore(key, 0, Date.now() - PRESENCE_TTL_MS);
        return await this.redis.zcard(key);
      });
    } catch {
      return 0;
    }
  }

  async touchPresence(room: string, socketId: string): Promise<void> {
    if (!this.redisReady) return;
    const now = Date.now();
    try {
      await this.withRedis(async () => {
        await this.redis.zadd(CHAT_REDIS_KEYS.presence(room), now, socketId);
      });
    } catch {
      // presence heartbeat는 Redis 복구 전까지 건너뛴다.
    }
  }

  private async enqueuePersist(message: ChatMessage): Promise<void> {
    if (!(await this.chatSettings.isPersistEnabled())) {
      return;
    }
    const row = this.toPersistRow(message);

    try {
      await this.persistQueue.add('persist', message, {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
      });
    } catch (error) {
      this.logger.error(
        `chat persist queue unavailable, falling back to direct insert: ${error instanceof Error ? error.message : error}`,
      );
      try {
        await this.chatRepo.insertMessage(row);
      } catch (dbError) {
        this.logger.error(
          `chat durable persist failed for ${message.id}: ${dbError instanceof Error ? dbError.message : dbError}`,
        );
      }
    }
  }

  isValidGuestNicknameFormat(nickname: string): boolean {
    return (
      nickname.length >= CHAT_LIMITS.NICKNAME_MIN &&
      nickname.length <= CHAT_LIMITS.NICKNAME_MAX &&
      GUEST_NICKNAME_REGEX.test(nickname)
    );
  }

  private async verifyMemberToken(token: string): Promise<ChatIdentity | null> {
    try {
      const payload = this.jwtService.verify<GuestJwtPayload>(token);
      if (payload.typ === 'guest' || !payload.sub) {
        return null;
      }
      const user = await this.usersService.findById(payload.sub);
      if (!user) return null;
      return {
        kind: 'member',
        userId: user.id,
        nickname: user.name,
        status: user.status,
      };
    } catch {
      return null;
    }
  }

  async verifyGuestToken(token: string): Promise<ChatIdentity | null> {
    try {
      const payload = this.jwtService.verify<GuestJwtPayload>(token);
      if (payload.typ !== 'guest' || !payload.nick || !payload.gid) {
        return null;
      }
      if (!this.isValidGuestNicknameFormat(payload.nick)) {
        return null;
      }
      return {
        kind: 'guest',
        guestId: payload.gid,
        nickname: payload.nick,
      };
    } catch {
      return null;
    }
  }

  private extractCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;
    const parts = header.split(';');
    for (const part of parts) {
      const [key, ...rest] = part.trim().split('=');
      if (key === name) {
        return rest.join('=') || null;
      }
    }
    return null;
  }

  private toChatMessage(row: {
    id: string;
    roomSlug: string;
    authorType: 'member' | 'guest';
    userId: string | null;
    guestId: string | null;
    nickname: string;
    content: string;
    replyToId?: string | null;
    replyToNickname?: string | null;
    replyToContent?: string | null;
    createdAt: Date;
  }): ChatMessage {
    return {
      id: row.id,
      roomSlug: row.roomSlug,
      authorType: row.authorType,
      userId: row.userId,
      guestId: row.guestId,
      nickname: row.nickname,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      replyTo: this.toReplyTo(row),
    };
  }

  private toReplyTo(row: {
    replyToId?: string | null;
    replyToNickname?: string | null;
    replyToContent?: string | null;
  }): ChatReplyTo | null {
    if (!row.replyToId || !row.replyToNickname) return null;
    return {
      id: row.replyToId,
      nickname: row.replyToNickname,
      content: row.replyToContent ?? '',
    };
  }

  private toPersistRow(message: ChatMessage) {
    return {
      id: message.id,
      roomSlug: message.roomSlug,
      authorType: message.authorType,
      userId: message.userId,
      guestId: message.guestId,
      nickname: message.nickname,
      content: message.content,
      replyToId: message.replyTo?.id ?? null,
      replyToNickname: message.replyTo?.nickname ?? null,
      replyToContent: message.replyTo?.content ?? null,
      createdAt: new Date(message.createdAt),
    };
  }

  private async resolveReplyTo(room: string, replyToId?: string): Promise<ChatReplyTo | null> {
    if (!replyToId) return null;
    const cached = await this.findCachedMessage(room, replyToId);
    if (cached) {
      return { id: cached.id, nickname: cached.nickname, content: cached.content };
    }
    const row = await this.chatRepo.findById(replyToId, room);
    if (!row) return null;
    return { id: row.id, nickname: row.nickname, content: row.content };
  }

  private async findCachedMessage(room: string, id: string): Promise<ChatMessage | null> {
    try {
      const raw = await this.redis.lrange(CHAT_REDIS_KEYS.recent(room), 0, CHAT_LIMITS.RECENT_CACHE_SIZE - 1);
      for (const item of raw) {
        try {
          const parsed = JSON.parse(item) as ChatMessage;
          if (parsed.id === id) return parsed;
        } catch {
          // skip corrupt cache entries
        }
      }
    } catch {
      // cache miss falls through to DB
    }
    return null;
  }

  private async readRecentCache(room: string, limit: number): Promise<ChatMessage[]> {
    return this.withRedis(async () => {
      const raw = await this.redis.lrange(CHAT_REDIS_KEYS.recent(room), 0, limit - 1);
      if (!raw.length) return [];
      return raw
        .map((item) => {
          try {
            return JSON.parse(item) as ChatMessage;
          } catch {
            return null;
          }
        })
        .filter((item): item is ChatMessage => !!item)
        .reverse();
    });
  }

  private async pushRecentCache(room: string, message: ChatMessage): Promise<void> {
    await this.withRedis(async () => {
      const key = CHAT_REDIS_KEYS.recent(room);
      await this.redis.lpush(key, JSON.stringify(message));
      await this.redis.ltrim(key, 0, CHAT_LIMITS.RECENT_CACHE_SIZE - 1);
    });
  }

  private async backfillRecentCache(room: string, chronological: ChatMessage[]): Promise<void> {
    if (chronological.length === 0) return;
    await this.withRedis(async () => {
      const key = CHAT_REDIS_KEYS.recent(room);
      await this.redis.del(key);
      await this.redis.lpush(key, ...chronological.map((m) => JSON.stringify(m)));
      await this.redis.ltrim(key, 0, CHAT_LIMITS.RECENT_CACHE_SIZE - 1);
    });
  }

  private async consumeRateLimit(identityKey: string): Promise<boolean> {
    return this.withRedis(async () => {
      const key = CHAT_REDIS_KEYS.rate(identityKey);
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.pexpire(key, CHAT_LIMITS.RATE_LIMIT_WINDOW_MS);
      }
      return count <= CHAT_LIMITS.RATE_LIMIT_MAX;
    });
  }

  private async countPresence(room: string): Promise<number> {
    const now = Date.now();
    return this.withRedis(async () => {
      const key = CHAT_REDIS_KEYS.presence(room);
      await this.redis.zremrangebyscore(key, 0, now - PRESENCE_TTL_MS);
      return await this.redis.zcard(key);
    });
  }

  private setLive(next: boolean) {
    if (this.redisReady === next) return;
    this.redisReady = next;
    this.logger.log(next ? 'Chat Redis is available' : 'Chat Redis is unavailable');
    this.emitAvailability();
  }

  private setFeatureEnabled(next: boolean) {
    if (this.featureEnabled === next) return;
    this.featureEnabled = next;
    this.logger.log(next ? 'Chat feature enabled' : 'Chat feature disabled');
    this.emitAvailability();
  }

  private emitAvailability() {
    const next = this.isAccepting();
    if (this.lastEmittedAvailable === next) return;
    this.lastEmittedAvailable = next;
    for (const listener of this.availabilityListeners) {
      listener(next);
    }
  }

  private async refreshFeatureFlag() {
    try {
      this.setFeatureEnabled(await this.chatSettings.isEnabled());
    } catch (error) {
      this.logger.debug(
        `chat feature flag refresh skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private syncLiveFromStatus() {
    this.setLive(this.redis.status === 'ready');
  }

  private async probeRedis(): Promise<void> {
    if (this.probing) return;
    this.probing = true;
    try {
      if (this.redis.status === 'end') {
        await this.redis.connect();
      }
      if (this.redis.status === 'ready') {
        await this.redis.ping();
        this.setLive(true);
        return;
      }
      this.setLive(false);
    } catch {
      this.syncLiveFromStatus();
    } finally {
      this.probing = false;
      void this.refreshFeatureFlag();
    }
  }

  private async withRedis<T>(operation: () => Promise<T>): Promise<T> {
    this.assertLive();
    try {
      return await operation();
    } catch (error) {
      this.logger.warn(
        `Redis chat op failed: ${error instanceof Error ? error.message : error}`,
      );
      if (this.redis.status !== 'ready') {
        this.setLive(false);
      }
      throw new ChatDomainError(ErrorCode.CHAT_UNAVAILABLE);
    }
  }
}

export function isChatDomainError(error: unknown): error is ChatDomainError {
  return error instanceof ChatDomainError;
}

export function toHttpException(error: ChatDomainError) {
  const body = { message: error.message, errorCode: error.errorCode };
  if (error.errorCode === ErrorCode.CHAT_NICKNAME_TAKEN) {
    return new ConflictException(body);
  }
  if (error.errorCode === ErrorCode.CHAT_FORBIDDEN) {
    return new ForbiddenException(body);
  }
  if (error.errorCode === ErrorCode.CHAT_UNAUTHORIZED) {
    return new UnauthorizedException(body);
  }
  if (error.errorCode === ErrorCode.CHAT_RATE_LIMITED || error.errorCode === ErrorCode.TOO_MANY_REQUESTS) {
    return new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  }
  if (error.errorCode === ErrorCode.CHAT_UNAVAILABLE) {
    return new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
  }
  return new BadRequestException(body);
}
