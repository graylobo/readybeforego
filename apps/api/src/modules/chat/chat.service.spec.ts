import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@community/shared-types';
import { UsersService } from '../users/users.service';
import { ChatRepository } from './chat.repository';
import { ChatSettingsService } from './chat-settings.service';
import { ChatDomainError, ChatService } from './chat.service';

jest.mock('uuid', () => ({ v4: () => '12345678-1234-1234-1234-123456789012' }));

function createRedisMock(status: 'ready' | 'end' = 'ready') {
  let rate = 0;
  return {
    status,
    on: jest.fn(),
    incr: jest.fn().mockImplementation(() => Promise.resolve(++rate)),
    pexpire: jest.fn().mockResolvedValue(1),
    lpush: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    ltrim: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    zcard: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    connect: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ChatService', () => {
  let service: ChatService;
  let usersService: { isNameTaken: jest.Mock; findById: jest.Mock };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let chatRepo: { insertMessage: jest.Mock; findRecent: jest.Mock; findById: jest.Mock };
  let persistQueue: { add: jest.Mock };
  let chatSettings: { isPersistEnabled: jest.Mock; isEnabled: jest.Mock };
  let redis: ReturnType<typeof createRedisMock>;

  function createService() {
    return new ChatService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      chatRepo as unknown as ChatRepository,
      persistQueue as any,
      redis as any,
      chatSettings as unknown as ChatSettingsService,
    );
  }

  beforeEach(() => {
    usersService = {
      isNameTaken: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    chatRepo = {
      insertMessage: jest.fn(),
      findRecent: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
    };
    persistQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    chatSettings = {
      isPersistEnabled: jest.fn().mockResolvedValue(true),
      isEnabled: jest.fn().mockResolvedValue(true),
    };
    redis = createRedisMock('ready');

    service = createService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('claimGuestNickname', () => {
    it('회원 닉네임과 중복되면 CHAT_NICKNAME_TAKEN을 던진다', async () => {
      usersService.isNameTaken.mockResolvedValue(true);

      await expect(service.claimGuestNickname('기존닉네임')).rejects.toMatchObject({
        errorCode: ErrorCode.CHAT_NICKNAME_TAKEN,
      });
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('공백이 포함된 닉네임은 CHAT_NICKNAME_INVALID을 던진다', async () => {
      await expect(service.claimGuestNickname('닉 네임')).rejects.toMatchObject({
        errorCode: ErrorCode.CHAT_NICKNAME_INVALID,
      });
    });

    it('사용 가능한 닉네임이면 게스트 토큰을 발급한다', async () => {
      usersService.isNameTaken.mockResolvedValue(false);
      jwtService.sign.mockReturnValue('guest-jwt');

      const result = await service.claimGuestNickname('게스트닉');

      expect(result).toEqual({
        token: 'guest-jwt',
        nickname: '게스트닉',
        guestId: expect.any(String),
        expiresIn: 30 * 24 * 60 * 60,
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ typ: 'guest', nick: '게스트닉', gid: expect.any(String) }),
        { expiresIn: '30d' },
      );
    });
  });

  describe('assertCanSend', () => {
    it('신원이 없으면 CHAT_UNAUTHORIZED를 던진다', async () => {
      await expect(service.assertCanSend(null)).rejects.toMatchObject({
        errorCode: ErrorCode.CHAT_UNAUTHORIZED,
      });
    });

    it('정지/차단된 회원은 CHAT_FORBIDDEN을 던진다', async () => {
      await expect(
        service.assertCanSend({
          kind: 'member',
          userId: 'u1',
          nickname: '회원',
          status: 'banned',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.CHAT_FORBIDDEN });
    });

    it('게스트 닉네임이 이후 회원과 충돌하면 CHAT_NICKNAME_TAKEN을 던진다', async () => {
      usersService.isNameTaken.mockResolvedValue(true);

      await expect(
        service.assertCanSend({
          kind: 'guest',
          guestId: 'g1',
          nickname: '충돌닉',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.CHAT_NICKNAME_TAKEN });
    });
  });

  describe('sendMessage', () => {
    const guest = { kind: 'guest' as const, guestId: 'g1', nickname: '게스트닉' };

    beforeEach(() => {
      usersService.isNameTaken.mockResolvedValue(false);
    });

    it('메시지를 캐시하고 persist 큐에 넣는다', async () => {
      const message = await service.sendMessage(guest, '안녕하세요', 'lobby');

      expect(message.content).toBe('안녕하세요');
      expect(message.authorType).toBe('guest');
      expect(message.nickname).toBe('게스트닉');
      expect(message.guestId).toBe('g1');
      expect(redis.lpush).toHaveBeenCalled();
      expect(persistQueue.add).toHaveBeenCalledWith(
        'persist',
        expect.objectContaining({ content: '안녕하세요', guestId: 'g1' }),
        expect.any(Object),
      );
    });

    it('큐가 실패해도 직접 DB insert로 폴백하고 메시지는 반환한다', async () => {
      persistQueue.add.mockRejectedValue(new Error('redis down'));
      chatRepo.insertMessage.mockResolvedValue({});

      const message = await service.sendMessage(guest, '폴백', 'lobby');

      expect(message.content).toBe('폴백');
      expect(chatRepo.insertMessage).toHaveBeenCalled();
    });

    it('빈 메시지는 CHAT_MESSAGE_INVALID을 던진다', async () => {
      await expect(service.sendMessage(guest, '   ', 'lobby')).rejects.toBeInstanceOf(ChatDomainError);
      await expect(service.sendMessage(guest, '   ', 'lobby')).rejects.toMatchObject({
        errorCode: ErrorCode.CHAT_MESSAGE_INVALID,
      });
    });

    it('관리자 설정에서 DB 저장이 꺼져 있으면 큐와 DB에 넣지 않는다', async () => {
      chatSettings.isPersistEnabled.mockResolvedValue(false);

      const message = await service.sendMessage(guest, '캐시만', 'lobby');

      expect(message.content).toBe('캐시만');
      expect(persistQueue.add).not.toHaveBeenCalled();
      expect(chatRepo.insertMessage).not.toHaveBeenCalled();
    });

    it('Redis가 내려가 있으면 CHAT_UNAVAILABLE을 던지고 큐에 넣지 않는다', async () => {
      service.onModuleDestroy();
      redis = createRedisMock('end');
      service = createService();

      await expect(service.sendMessage(guest, '캐시만', 'lobby')).rejects.toMatchObject({
        errorCode: ErrorCode.CHAT_UNAVAILABLE,
      });
      expect(persistQueue.add).not.toHaveBeenCalled();
      expect(chatRepo.insertMessage).not.toHaveBeenCalled();
    });

    it('짧은 시간에 너무 많이 보내면 CHAT_RATE_LIMITED를 던진다', async () => {
      for (let i = 0; i < 5; i += 1) {
        await service.sendMessage(guest, `메시지${i}`, 'lobby');
      }

      await expect(service.sendMessage(guest, '초과', 'lobby')).rejects.toMatchObject({
        errorCode: ErrorCode.CHAT_RATE_LIMITED,
      });
    });

    it('허용되지 않은 방이면 INVALID_INPUT을 던진다', async () => {
      await expect(service.sendMessage(guest, '안녕', 'secret')).rejects.toMatchObject({
        errorCode: ErrorCode.INVALID_INPUT,
      });
    });

    it('replyToId가 있으면 원 메시지 스냅샷을 붙인다', async () => {
      redis.lrange.mockResolvedValue([
        JSON.stringify({
          id: '11111111-1111-1111-1111-111111111111',
          nickname: '하루',
          content: '!모더나',
        }),
      ]);

      const message = await service.sendMessage(
        guest,
        '답글입니다',
        'lobby',
        '11111111-1111-1111-1111-111111111111',
      );

      expect(message.replyTo).toEqual({
        id: '11111111-1111-1111-1111-111111111111',
        nickname: '하루',
        content: '!모더나',
      });
    });
  });
});
