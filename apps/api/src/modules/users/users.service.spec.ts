import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from '../uploads/uploads.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
jest.mock('uuid', () => ({ v4: () => '12345678-1234-1234-1234-123456789012' }));

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;
  let uploads: jest.Mocked<UploadsService>;

  beforeEach(async () => {
    // 의존성 Mocking
    const mockUsersRepository = {
      findAll: jest.fn(),
      findBySocialOrEmail: jest.fn(),
      updateUser: jest.fn(),
      createUser: jest.fn(),
      findById: jest.fn(),
      findPublicProfile: jest.fn(),
      findUserPoints: jest.fn(),
      countUserPosts: jest.fn(),
      countUserVisitDays: jest.fn(),
      findByName: jest.fn(),
      deleteUser: jest.fn(),
    };

    const mockUploadsService = {
      deleteImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UploadsService, useValue: mockUploadsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(UsersRepository);
    uploads = module.get(UploadsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrUpdate', () => {
    it('소셜 로그인 시 기존 유저가 있으면 업데이트해야 한다', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        isProfileSetup: true,
        name: '기존닉네임',
      };
      
      repo.findBySocialOrEmail.mockResolvedValue(mockUser as any);
      repo.updateUser.mockResolvedValue({ ...mockUser, googleId: '123' } as any);

      const result = await service.createOrUpdate({
        email: 'test@test.com',
        googleId: '123',
        name: '구글닉네임', // 프로필 세팅이 끝난 유저라면 기존 닉네임을 보호해야 함
      });

      expect(repo.findBySocialOrEmail).toHaveBeenCalledWith(expect.any(Object));
      expect(repo.updateUser).toHaveBeenCalledWith('1', {
        email: 'test@test.com',
        googleId: '123',
        // name은 제외되어야 함 (isProfileSetup 보호 로직)
      });
      expect(result.googleId).toBe('123');
    });

    it('신규 유저인 경우 필수값이 존재하면 생성해야 한다', async () => {
      repo.findBySocialOrEmail.mockResolvedValue(undefined as any);
      repo.createUser.mockResolvedValue({ id: '2', email: 'new@test.com', name: '새유저' } as any);

      const result = await service.createOrUpdate({
        email: 'new@test.com',
        name: '새유저',
      });

      expect(repo.createUser).toHaveBeenCalledWith({
        email: 'new@test.com',
        name: '새유저',
        picture: undefined,
        googleId: undefined,
        kakaoId: undefined,
        naverId: undefined,
      });
      expect(result.id).toBe('2');
    });

    it('신규 유저 생성 시 이름이 없으면 에러를 던져야 한다', async () => {
      repo.findBySocialOrEmail.mockResolvedValue(undefined as any);

      await expect(service.createOrUpdate({ email: 'no-name@test.com' })).rejects.toThrow('Name is required for new user');
    });
  });

  describe('update', () => {
    it('프로필 이미지 변경 시 기존 고립된 스토리지 이미지를 삭제 요청해야 한다', async () => {
      const mockUser = {
        id: '1',
        picture: 'http://example.com/profiles/old.png',
      };
      repo.findById.mockResolvedValue(mockUser as any);
      repo.updateUser.mockResolvedValue({ ...mockUser, picture: 'new.png' } as any);
      uploads.deleteImage.mockResolvedValue(undefined);

      await service.update('1', { picture: 'new.png' });

      expect(uploads.deleteImage).toHaveBeenCalledWith('profiles/old.png');
      expect(repo.updateUser).toHaveBeenCalledWith('1', { picture: 'new.png' });
    });

    it('이미 존재하는 닉네임으로 변경 시 ConflictException을 던져야 한다', async () => {
      repo.findByName.mockResolvedValue({ id: 'other-user', name: '중복닉네임' } as any);

      await expect(service.update('my-id', { name: '중복닉네임' }))
        .rejects.toThrow(ConflictException);
    });

  });

  describe('getPublicProfile', () => {
    it('유저 공개 프로필 및 관련 지표를 조합하여 반환해야 한다', async () => {
      repo.findPublicProfile.mockResolvedValue({ id: '1', name: '테스터' } as any);
      repo.findUserPoints.mockResolvedValue(100);
      repo.countUserPosts.mockResolvedValue(5);
      repo.countUserVisitDays.mockResolvedValue(10);

      const result = await service.getPublicProfile('1');

      expect(result).toEqual({
        id: '1',
        name: '테스터',
        points: 100,
        postCount: 5,
        visitDays: 10,
      });
    });
  });
});
