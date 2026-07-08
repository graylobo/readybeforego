import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LogsService } from '../logs/logs.service';

jest.mock('uuid', () => ({ v4: () => '12345678-1234-1234-1234-123456789012' }));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let logsService: jest.Mocked<LogsService>;

  beforeEach(async () => {
    const mockUsersService = {
      createOrUpdate: jest.fn(),
      findById: jest.fn(),
    };
    const mockJwtService = {
      sign: jest.fn(),
    };
    const mockLogsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: LogsService, useValue: mockLogsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    logsService = module.get(LogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateGoogleUser', () => {
    it('프로필 정보가 주어지면 createOrUpdate를 호출해야 한다', async () => {
      const profile = {
        id: 'google-123',
        displayName: '구글테스터',
        emails: [{ value: 'google@test.com' }],
        photos: [{ value: 'http://photo.com' }],
      };

      usersService.createOrUpdate.mockResolvedValue({ id: '1', name: '구글테스터' } as any);

      const result = await service.validateGoogleUser(profile);

      expect(usersService.createOrUpdate).toHaveBeenCalledWith({
        email: 'google@test.com',
        name: '구글테스터',
        picture: 'http://photo.com',
        googleId: 'google-123',
      });
      expect(result).toEqual({ id: '1', name: '구글테스터' });
    });
  });

  describe('login', () => {
    it('유저 정보로 JWT 토큰을 발급하고 로그를 남겨야 한다', () => {
      const mockUser = { id: '1', email: 'test@test.com', name: '테스터' };
      jwtService.sign.mockReturnValue('mock-token');

      const result = service.login(mockUser, '127.0.0.1', 'Mozilla');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '1',
        email: 'test@test.com',
        name: '테스터',
      });
      expect(logsService.create).toHaveBeenCalledWith({
        userId: '1',
        type: 'LOGIN',
        action: '소셜 로그인을 통한 접속',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla',
      });
      expect(result).toEqual({
        access_token: 'mock-token',
        user: mockUser,
      });
    });
  });

  describe('validateUser', () => {
    it('페이로드의 sub로 유저를 찾아 반환해야 한다', async () => {
      usersService.findById.mockResolvedValue({ id: '1', name: '테스터' } as any);

      const result = await service.validateUser({ sub: '1' });

      expect(usersService.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual({ id: '1', name: '테스터' });
    });
  });
});
