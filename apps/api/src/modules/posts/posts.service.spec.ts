import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { BoardsService } from '../boards/boards.service';
import { UploadsService } from '../uploads/uploads.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostsRepository } from './posts.repository';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';

jest.mock('uuid', () => ({ v4: () => '12345678-1234-1234-1234-123456789012' }));

describe('PostsService', () => {
  let service: PostsService;
  let boardsService: jest.Mocked<BoardsService>;
  let uploadsService: jest.Mocked<UploadsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let postsRepository: jest.Mocked<PostsRepository>;

  beforeEach(async () => {
    const mockBoardsService = {
      findBySlug: jest.fn(),
    };
    const mockUploadsService = {
      moveTempImages: jest.fn(),
      cleanupOrphanImages: jest.fn(),
      deleteDirectory: jest.fn(),
    };
    const mockEventEmitter = {
      emit: jest.fn(),
    };
    const mockPostsRepository = {
      searchPosts: jest.fn(),
      countPosts: jest.fn(),
      getReactionCountsForPosts: jest.fn(),
      findByIdWithDetails: jest.fn(),
      findUserById: jest.fn(),
      incrementViewCount: jest.fn(),
      getReactionCountsForPost: jest.fn(),
      findUserReaction: jest.fn(),
      findUserScrap: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      findById: jest.fn(),
      transaction: jest.fn(),
      softDeletePost: jest.fn(),
      softDeleteCommentsByPost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: BoardsService, useValue: mockBoardsService },
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: PostsRepository, useValue: mockPostsRepository },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    boardsService = module.get(BoardsService);
    uploadsService = module.get(UploadsService);
    eventEmitter = module.get(EventEmitter2);
    postsRepository = module.get(PostsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('존재하지 않는 게시판에 글을 쓰면 에러를 던져야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue(null);

      await expect(service.create('userId1', 'unknown-slug', { boardSlug: 'unknown-slug', title: 'T', content: 'C', category: '' }))
        .rejects.toThrow(ApiException);
    });

    it('게시판이 존재하고 권한이 있으면 게시글을 생성하고 이벤트를 발생시켜야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', name: '자유게시판', isPrivate: false, allowAnonymous: false, slug: 'free' } as any);
      postsRepository.createPost.mockResolvedValue({ id: 'post1', title: 'T', content: 'C' } as any);
      uploadsService.moveTempImages.mockResolvedValue('C'); // unchanged

      const result = await service.create('user1', 'free', { boardSlug: 'free', title: 'T', content: 'C', category: '' }, '127.0.0.1', 'Mozilla');

      expect(postsRepository.createPost).toHaveBeenCalled();
      expect(result.id).toBe('post1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('post.created', expect.any(Object));
    });
  });

  describe('update', () => {
    it('본인 글이 아니라면 FORBIDDEN을 던져야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'post1', userId: 'authorUser' } as any);
      postsRepository.findUserById.mockResolvedValue({ id: 'otherUser', role: 'user' } as any);

      await expect(service.update('post1', 'otherUser', { title: 'New T' }))
        .rejects.toThrow(ApiException);
    });

    it('본인 글이라면 수정되어야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'post1', content: 'Old', userId: 'user1' } as any);
      postsRepository.findUserById.mockResolvedValue({ id: 'user1', role: 'user' } as any);
      postsRepository.updatePost.mockResolvedValue({ id: 'post1', title: 'New T' } as any);
      uploadsService.moveTempImages.mockResolvedValue('New Content');
      uploadsService.cleanupOrphanImages.mockResolvedValue(true as any);

      const result = await service.update('post1', 'user1', { title: 'New T', content: 'New Content' });

      expect(postsRepository.updatePost).toHaveBeenCalledWith('post1', expect.objectContaining({ content: 'New Content' }));
      expect(eventEmitter.emit).toHaveBeenCalledWith('post.updated', expect.any(Object));
    });
  });
});
