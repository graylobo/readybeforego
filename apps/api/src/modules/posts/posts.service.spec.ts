import { BoardManagersService } from '../boards/board-managers.service';
import { isAdmin } from '@community/shared-types';
import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { BoardsService } from '../boards/boards.service';
import { UploadsService } from '../uploads/uploads.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostsRepository } from './posts.repository';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';
import { PgDialect } from 'drizzle-orm/pg-core';

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
      deleteDirectory: jest.fn().mockResolvedValue(undefined),
      deleteImage: jest.fn().mockResolvedValue(undefined),
      extractPathFromUrl: jest.fn((url: string) => url.replace('https://cdn/', '')),
      extractImagePaths: jest.fn((content: string, folder: string) =>
        UploadsService.prototype.extractImagePaths.call(null, content, folder),
      ),
    };
    const mockEventEmitter = {
      emit: jest.fn(),
    };
    const mockPostsRepository = {
      searchPosts: jest.fn(),
      countPosts: jest.fn(),
      getUserReactionsForPosts: jest.fn().mockResolvedValue([]),
      findByIdWithDetails: jest.fn(),
      findUserById: jest.fn(),
      findBotSources: jest.fn().mockResolvedValue([]),
      incrementViewCount: jest.fn(),
      findReactionTarget: jest.fn(),
      toggleScrap: jest.fn().mockResolvedValue(true),
      createReaction: jest.fn(),
      deleteReaction: jest.fn(),
      updateReaction: jest.fn(),
      applyReactionDelta: jest.fn(),
      findUserReaction: jest.fn(),
      findUserScrap: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      findById: jest.fn(),
      transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({})),
      softDeletePost: jest.fn(),
      softDeleteCommentsByPost: jest.fn(),
      findCommentImagesByPost: jest.fn().mockResolvedValue([]),
      findAuthorCommentIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: BoardsService, useValue: mockBoardsService },
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: PostsRepository, useValue: mockPostsRepository },
        // 실제와 같이 사이트 관리자는 모든 게시판을 관리할 수 있다 (게시판 매니저 여부는 테스트마다 바꿔 씀)
        { provide: BoardManagersService, useValue: { canModerate: jest.fn(async (_boardId: string, v: { userId?: string; role?: string }) => !!v.userId && isAdmin(v.role as any)) } },
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
      boardsService.findBySlug.mockResolvedValue(undefined as any);

      await expect(service.create({ userId: 'userId1' }, 'unknown-slug', { boardSlug: 'unknown-slug', title: 'T', content: 'C', category: '' }))
        .rejects.toThrow(ApiException);
    });

    it('비회원 글은 비밀번호가 없으면 거절해야 한다 (비밀번호 없이는 수정/삭제할 수 없음)', async () => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', name: '자유게시판', isPrivate: false, allowAnonymous: true, slug: 'free' } as any);

      await expect(service.create({ ipAddress: '203.0.113.7' }, 'free', { boardSlug: 'free', title: 'T', content: 'C', guestName: '손님' }))
        .rejects.toMatchObject({ status: 400 });
      expect(postsRepository.createPost).not.toHaveBeenCalled();
    });

    it('게시판이 존재하고 권한이 있으면 게시글을 생성하고 이벤트를 발생시켜야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', name: '자유게시판', isPrivate: false, allowAnonymous: false, slug: 'free' } as any);
      postsRepository.createPost.mockResolvedValue({ id: 'post1', title: 'T', content: 'C' } as any);
      uploadsService.moveTempImages.mockResolvedValue('C'); // unchanged

      const result = await service.create({ userId: 'user1', role: 'user', ipAddress: '127.0.0.1' }, 'free', { boardSlug: 'free', title: 'T', content: 'C', category: '' }, 'Mozilla');

      expect(postsRepository.createPost).toHaveBeenCalled();
      expect(result.id).toBe('post1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('post.created', expect.any(Object));
    });

    it('본문을 정화한 뒤 임시 이미지를 옮기고, 미리 정한 id로 한 번에 저장해야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', name: '자유게시판', isPrivate: false, allowAnonymous: false, slug: 'free' } as any);
      uploadsService.moveTempImages.mockImplementation(async (content: string) => content.replace('/temp/', '/posts/'));
      postsRepository.createPost.mockImplementation(async (data: any) => data);

      await service.create({ userId: 'user1', role: 'user' }, 'free', {
        boardSlug: 'free',
        title: 'T',
        content: '<p>a</p><img src="https://cdn/temp/a.png"><script>alert(1)</script>',
        category: '',
      });

      const [contentArg, folderArg] = uploadsService.moveTempImages.mock.calls[0];
      expect(contentArg).not.toContain('<script>');
      const saved = postsRepository.createPost.mock.calls[0][0];
      expect(folderArg).toBe(`posts/${saved.id}`);
      expect(saved.content).toContain('/posts/a.png');
      expect(saved.hasImage).toBe(true);
      expect(postsRepository.updatePost).not.toHaveBeenCalled();
    });

    it('인증 단계의 역할이 관리자면 사용자를 다시 조회하지 않고 공지 설정을 허용해야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', name: '공지', isPrivate: false, allowAnonymous: false, slug: 'news' } as any);
      uploadsService.moveTempImages.mockResolvedValue('C');
      postsRepository.createPost.mockImplementation(async (data: any) => data);

      await service.create({ userId: 'admin1', role: 'admin' }, 'news', { boardSlug: 'news', title: 'T', content: 'C', category: '', isNotice: true });

      expect(postsRepository.createPost.mock.calls[0][0].isNotice).toBe(true);
      expect(postsRepository.findUserById).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('본인 글이 아니라면 FORBIDDEN을 던져야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'post1', userId: 'authorUser' } as any);
      postsRepository.findUserById.mockResolvedValue({ id: 'otherUser', role: 'user' } as any);

      await expect(service.update('post1', { userId: 'otherUser', role: 'user' }, { title: 'New T' }))
        .rejects.toThrow(ApiException);
    });

    it('본인 글이라면 수정되어야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'post1', content: 'Old', userId: 'user1' } as any);
      postsRepository.findUserById.mockResolvedValue({ id: 'user1', role: 'user' } as any);
      postsRepository.updatePost.mockResolvedValue({ id: 'post1', title: 'New T' } as any);
      uploadsService.moveTempImages.mockResolvedValue('New Content');
      uploadsService.cleanupOrphanImages.mockResolvedValue(true as any);

      await service.update('post1', { userId: 'user1', role: 'user' }, { title: 'New T', content: 'New Content' });

      expect(postsRepository.updatePost).toHaveBeenCalledWith('post1', expect.objectContaining({ content: 'New Content' }));
      expect(eventEmitter.emit).toHaveBeenCalledWith('post.updated', expect.any(Object));
    });
  });

  describe('findOne - 응답 필드 노출 제한', () => {
    const botPost = {
      id: 'post-1',
      userId: 'bot-user',
      isBot: true,
      guestPassword: '$2b$10$hashedguestpassword',
      viewCount: 0,
      commentCount: 0,
      board: { isPrivate: false },
    };

    beforeEach(() => {
      postsRepository.findByIdWithDetails.mockResolvedValue(botPost as any);
      postsRepository.findUserReaction.mockResolvedValue(undefined as any);
      postsRepository.findUserScrap.mockResolvedValue(undefined as any);
    });

    it('비로그인 사용자에게는 isBot을 내려주지 않아야 한다', async () => {
      const result = await service.findOne('post-1');
      expect(result).not.toHaveProperty('isBot');
    });

    it('일반 사용자와 admin에게는 isBot을 내려주지 않아야 한다', async () => {
      for (const role of ['user', 'admin']) {
        postsRepository.findUserById.mockResolvedValue({ id: 'u1', role } as any);
        const result = await service.findOne('post-1', { userId: 'u1' });
        expect(result).not.toHaveProperty('isBot');
      }
    });

    it('super_admin에게는 isBot을 내려줘야 한다', async () => {
      postsRepository.findUserById.mockResolvedValue({ id: 'u1', role: 'super_admin' } as any);
      const result = await service.findOne('post-1', { userId: 'u1' });
      expect(result).toHaveProperty('isBot', true);
    });

    it('super_admin에게는 봇 글의 수집 갤러리(botSource)를 내려줘야 한다', async () => {
      postsRepository.findUserById.mockResolvedValue({ id: 'u1', role: 'super_admin' } as any);
      postsRepository.findBotSources.mockResolvedValue([
        { postId: 'post-1', targetName: '광상갤', galleryId: 'no3miggi33' },
      ]);
      const result = await service.findOne('post-1', { userId: 'u1' });
      expect(result).toHaveProperty('botSource', { targetName: '광상갤', galleryId: 'no3miggi33' });
    });

    it('super_admin이 아니면 botSource를 조회하지도 내려주지도 않아야 한다', async () => {
      postsRepository.findUserById.mockResolvedValue({ id: 'u1', role: 'user' } as any);
      const result = await service.findOne('post-1', { userId: 'u1' });
      expect(result).not.toHaveProperty('botSource');
      expect(postsRepository.findBotSources).not.toHaveBeenCalled();
    });

    it('인증 단계에서 읽은 역할을 넘겨받으면 사용자를 다시 조회하지 않아야 한다', async () => {
      const result = await service.findOne('post-1', { userId: 'u1', role: 'super_admin' });
      expect(result).toHaveProperty('isBot', true);
      expect(postsRepository.findUserById).not.toHaveBeenCalled();
    });

    it('상세 조회는 조회수를 올리지 않아야 한다 (조회수는 recordView로 따로 기록)', async () => {
      await service.findOne('post-1');
      expect(postsRepository.incrementViewCount).not.toHaveBeenCalled();
    });

    it('누구에게도 비밀번호 해시(guestPassword)를 내려주지 않아야 한다', async () => {
      expect(await service.findOne('post-1')).not.toHaveProperty('guestPassword');
      postsRepository.findUserById.mockResolvedValue({ id: 'u1', role: 'super_admin' } as any);
      expect(await service.findOne('post-1', { userId: 'u1' })).not.toHaveProperty('guestPassword');
    });
  });

  describe('findOne - 접근 제어', () => {
    it('없는 게시글이면 404(POST_NOT_FOUND)를 던져야 한다', async () => {
      postsRepository.findByIdWithDetails.mockResolvedValue(undefined as any);
      await expect(service.findOne('missing')).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({ errorCode: ErrorCode.POST_NOT_FOUND }),
      });
    });

    it('비공개 게시판 글은 비로그인 401, 다른 회원 403이어야 한다', async () => {
      postsRepository.findByIdWithDetails.mockResolvedValue({
        id: 'p1', userId: 'owner', isBot: false, viewCount: 0, board: { isPrivate: true },
      } as any);
      await expect(service.findOne('p1')).rejects.toMatchObject({ status: 401 });
      await expect(service.findOne('p1', { userId: 'other', role: 'user' })).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('recordView', () => {
    it('조회수를 올리고 바뀐 조회수를 돌려줘야 한다', async () => {
      postsRepository.incrementViewCount.mockResolvedValue(8 as any);
      await expect(service.recordView('post-1')).resolves.toEqual({ viewCount: 8 });
    });

    it('없거나 삭제된 글이면 404', async () => {
      postsRepository.incrementViewCount.mockResolvedValue(undefined as any);
      await expect(service.recordView('post-1')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('toggleReaction - 저장된 추천 수 갱신', () => {
    beforeEach(() => {
      postsRepository.findReactionTarget.mockResolvedValue({
        id: 'p1', userId: 'author', title: 'T', isBest: false, boardSlug: 'free',
      } as any);
      postsRepository.applyReactionDelta.mockResolvedValue({ likeCount: 3, dislikeCount: 0, isBest: false } as any);
    });

    it('처음 추천하면 추천 수를 1 올리고 알림 이벤트를 보내야 한다', async () => {
      postsRepository.findUserReaction.mockResolvedValue(undefined as any);
      postsRepository.createReaction.mockResolvedValue(true);

      const result = await service.toggleReaction('p1', { userId: 'u1' }, 'like');

      expect(postsRepository.applyReactionDelta).toHaveBeenCalledWith('p1', 1, 0, {});
      expect(result).toEqual({ likeCount: 3, dislikeCount: 0, userReaction: 'like' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('post.reaction', expect.any(Object));
    });

    it('같은 반응을 다시 누르면 취소하고 추천 수를 1 내려야 한다', async () => {
      postsRepository.findUserReaction.mockResolvedValue({ id: 'r1', type: 'like' } as any);
      postsRepository.deleteReaction.mockResolvedValue(true);

      const result = await service.toggleReaction('p1', { userId: 'u1' }, 'like');

      expect(postsRepository.applyReactionDelta).toHaveBeenCalledWith('p1', -1, 0, {});
      expect(result.userReaction).toBeNull();
    });

    it('추천에서 비추천으로 바꾸면 추천 -1, 비추천 +1 해야 한다', async () => {
      postsRepository.findUserReaction.mockResolvedValue({ id: 'r1', type: 'like' } as any);
      postsRepository.updateReaction.mockResolvedValue(true);

      await service.toggleReaction('p1', { userId: 'u1' }, 'dislike');

      expect(postsRepository.updateReaction).toHaveBeenCalledWith('r1', 'like', 'dislike', {});
      expect(postsRepository.applyReactionDelta).toHaveBeenCalledWith('p1', -1, 1, {});
    });

    it('동시에 눌러 이미 다른 요청이 추가했다면 추천 수를 바꾸지 않아야 한다', async () => {
      postsRepository.findUserReaction.mockResolvedValue(undefined as any);
      postsRepository.createReaction.mockResolvedValue(false);

      await service.toggleReaction('p1', { userId: 'u1' }, 'like');

      expect(postsRepository.applyReactionDelta).toHaveBeenCalledWith('p1', 0, 0, {});
    });
  });

  describe('getBoardPage - 게시판 화면 한 번에 조회', () => {
    const listRow = (id: string) => ({ post: { id, isBot: false }, user: null, board: { slug: 'free', name: '자유' } });

    beforeEach(() => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', slug: 'free', name: '자유', isPrivate: false, viewMode: 'list' } as any);
      postsRepository.searchPosts.mockImplementation(async (_where: any, _offset: number, limit: number) =>
        limit === 5 ? [listRow('notice')] : limit === 10 ? [listRow('best')] : [listRow('main')],
      );
      postsRepository.countPosts.mockResolvedValue(1);
    });

    it('첫 페이지면 공지/인기글/목록을 함께 주고, 내 반응은 한 번에 조회해야 한다', async () => {
      postsRepository.getUserReactionsForPosts.mockResolvedValue([{ postId: 'best', type: 'like' }] as any);

      const result = await service.getBoardPage('free', { page: 1 }, { userId: 'u1', role: 'user' });

      expect(result.board.slug).toBe('free');
      expect(result.notices.map((p: any) => p.id)).toEqual(['notice']);
      expect(result.best[0]).toMatchObject({ id: 'best', userReaction: 'like' });
      expect(result.posts).toMatchObject({ total: 1, items: [expect.objectContaining({ id: 'main' })] });
      expect(postsRepository.getUserReactionsForPosts).toHaveBeenCalledTimes(1);
      expect(postsRepository.getUserReactionsForPosts).toHaveBeenCalledWith(expect.arrayContaining(['notice', 'best', 'main']), 'u1');
      // 목록형 게시판은 본문을 읽지 않는다
      postsRepository.searchPosts.mock.calls.forEach((call) => expect(call[3]).toBe(false));
    });

    it('검색 중이거나 2페이지 이상이면 공지/인기글을 따로 조회하지 않아야 한다', async () => {
      const result = await service.getBoardPage('free', { page: 2 });
      expect(result.notices).toEqual([]);
      expect(result.best).toEqual([]);
      expect(postsRepository.searchPosts).toHaveBeenCalledTimes(1);
    });

    it('피드형 게시판은 본문을 포함해 조회해야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', slug: 'free', name: '자유', isPrivate: false, viewMode: 'feed' } as any);
      await service.getBoardPage('free', { page: 1 });
      postsRepository.searchPosts.mock.calls.forEach((call) => expect(call[3]).toBe(true));
    });

    it('없는 게시판이면 404(BOARD_NOT_FOUND)를 던져야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue(undefined as any);
      await expect(service.getBoardPage('nope', {})).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({ errorCode: ErrorCode.BOARD_NOT_FOUND }),
      });
    });

    it('비공개 게시판은 비로그인에게 빈 목록을 줘야 한다', async () => {
      boardsService.findBySlug.mockResolvedValue({ id: 'b2', slug: 'inquiry', name: '문의', isPrivate: true, viewMode: 'list' } as any);
      const result = await service.getBoardPage('inquiry', { page: 1 });
      expect(result.posts).toEqual({ items: [], total: 0 });
      expect(postsRepository.searchPosts).not.toHaveBeenCalled();
    });
  });

  describe('remove - 스토리지 이미지 정리', () => {
    const crawledContent =
      '<img src="https://cdn/crawled/1-a.webp" srcset="https://cdn/crawled/1-a-w720.webp 720w, https://cdn/crawled/1-a.webp 1600w" />';
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    it('크롤러 글은 crawled 폴더의 본문 이미지와 작은 버전도 지워야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'post1', userId: 'user1', isBot: true, content: crawledContent } as any);

      await service.remove('post1', { userId: 'user1', role: 'user' });
      await flush();

      expect(uploadsService.deleteDirectory).toHaveBeenCalledWith('posts/post1');
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('crawled/1-a.webp');
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('crawled/1-a-w720.webp');
    });

    it('글을 지우면 그 글과 글쓴이가 그 글에 단 댓글로 받은 포인트를 회수해야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'post1', userId: 'user1', isBot: false, content: '' } as any);
      postsRepository.findAuthorCommentIds.mockResolvedValue(['c1', 'c2']);

      await service.remove('post1', { userId: 'user1', role: 'user' });

      const revoked = eventEmitter.emit.mock.calls
        .filter(([name]) => name === 'points.revoke')
        .map(([, e]: any[]) => `${e.actionType}:${e.relatedId}`);
      expect(revoked).toEqual(['POST_CREATED:post1', 'COMMENT_CREATED:c1', 'COMMENT_CREATED:c2']);
    });

    it('일반 글 본문에 붙여 넣은 crawled 이미지는 다른 글의 이미지일 수 있어 지우지 않아야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'post1', userId: 'user1', isBot: false, content: crawledContent } as any);

      await service.remove('post1', { userId: 'user1', role: 'user' });
      await flush();

      expect(uploadsService.deleteDirectory).toHaveBeenCalledWith('posts/post1');
      expect(uploadsService.deleteImage).not.toHaveBeenCalled();
    });
  });

  describe('비공개 게시판 글의 추천/스크랩', () => {
    const privatePost = { id: 'post1', userId: 'owner', title: 'T', isBest: false, boardSlug: 'inquiry', isPrivate: true };

    it('작성자/관리자가 아니면 스크랩할 수 없어야 한다 (스크랩 목록에 제목이 노출되는 것 방지)', async () => {
      postsRepository.findReactionTarget.mockResolvedValue(privatePost as any);

      await expect(service.toggleScrap('post1', { userId: 'other', role: 'user' })).rejects.toMatchObject({ status: 403 });
      await expect(service.toggleScrap('post1', { userId: 'owner', role: 'user' })).resolves.toEqual({ isScrapped: true });
      await expect(service.toggleScrap('post1', { userId: 'admin1', role: 'admin' })).resolves.toEqual({ isScrapped: true });
    });

    it('작성자/관리자가 아니면 추천할 수 없어야 한다', async () => {
      postsRepository.findReactionTarget.mockResolvedValue(privatePost as any);

      await expect(service.toggleReaction('post1', { ipAddress: '203.0.113.7' }, 'like')).rejects.toMatchObject({ status: 401 });
      await expect(service.toggleReaction('post1', { userId: 'other', role: 'user' }, 'like')).rejects.toMatchObject({ status: 403 });
      expect(postsRepository.createReaction).not.toHaveBeenCalled();
    });
  });

  describe('비공개 처리한 글 (Super Admin)', () => {
    const hiddenAt = new Date('2026-10-13T00:00:00Z');
    // 목록 조회 조건(SQL)을 글자로 바꿔 비공개 글을 거르는지 확인
    const whereSql = (call: any[]) => new PgDialect().sqlToQuery(call[0]).sql;

    beforeEach(() => {
      boardsService.findBySlug.mockResolvedValue({ id: 'board1', slug: 'free', name: '자유', isPrivate: false, viewMode: 'list' } as any);
      postsRepository.searchPosts.mockResolvedValue([]);
      postsRepository.countPosts.mockResolvedValue(0);
    });

    it('Super Admin이 아니면 상세는 404(POST_HIDDEN)이고, 작성자도 볼 수 없어야 한다', async () => {
      postsRepository.findByIdWithDetails.mockResolvedValue({
        id: 'p1', userId: 'owner', isBot: false, viewCount: 0, hiddenAt, board: { isPrivate: false },
      } as any);
      const hiddenError = { status: 404, response: expect.objectContaining({ errorCode: ErrorCode.POST_HIDDEN }) };
      await expect(service.findOne('p1')).rejects.toMatchObject(hiddenError);
      await expect(service.findOne('p1', { userId: 'owner', role: 'user' })).rejects.toMatchObject(hiddenError);
      await expect(service.findOne('p1', { userId: 'admin1', role: 'admin' })).rejects.toMatchObject(hiddenError);
    });

    it('Super Admin은 상세를 볼 수 있고, 검색엔진에는 넣지 않도록 noIndex여야 한다', async () => {
      postsRepository.findByIdWithDetails.mockResolvedValue({
        id: 'p1', userId: 'owner', isBot: false, viewCount: 0, hiddenAt, content: '<p>본문</p>', board: { isPrivate: false },
      } as any);
      const result = await service.findOne('p1', { userId: 'sa', role: 'super_admin' });
      expect(result).toMatchObject({ id: 'p1', hiddenAt, noIndex: true });
    });

    it('목록은 Super Admin이 아니면 비공개 글을 거르고, Super Admin이면 거르지 않아야 한다', async () => {
      await service.getBoardPage('free', { page: 2 }, { userId: 'u1', role: 'admin' });
      await service.findAll({ boardSlug: 'all' });
      await service.findAll({ boardSlug: 'best' }, { userId: 'u1', role: 'user' });
      postsRepository.searchPosts.mock.calls.forEach((call) => expect(whereSql(call)).toContain('"hidden_at" is null'));

      postsRepository.searchPosts.mockClear();
      await service.getBoardPage('free', { page: 2 }, { userId: 'sa', role: 'super_admin' });
      await service.findAll({ boardSlug: 'all' }, { userId: 'sa', role: 'super_admin' });
      postsRepository.searchPosts.mock.calls.forEach((call) => expect(whereSql(call)).not.toContain('hidden_at'));
    });

    it('Super Admin이 아니면 추천·스크랩도 404여야 한다', async () => {
      postsRepository.findReactionTarget.mockResolvedValue({
        id: 'p1', userId: 'owner', title: 'T', isBest: false, boardSlug: 'free', isPrivate: false, hiddenAt,
      } as any);
      await expect(service.toggleScrap('p1', { userId: 'owner', role: 'user' })).rejects.toMatchObject({ status: 404 });
      await expect(service.toggleReaction('p1', { ipAddress: '203.0.113.7' }, 'like')).rejects.toMatchObject({ status: 404 });
      expect(postsRepository.toggleScrap).not.toHaveBeenCalled();
      expect(postsRepository.createReaction).not.toHaveBeenCalled();
      await expect(service.toggleScrap('p1', { userId: 'sa', role: 'super_admin' })).resolves.toEqual({ isScrapped: true });
    });

    it('비공개/공개 전환은 Super Admin만 할 수 있어야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'p1', hiddenAt: null } as any);
      await expect(service.setHidden('p1', {}, true)).rejects.toMatchObject({ status: 401 });
      await expect(service.setHidden('p1', { userId: 'a', role: 'admin' }, true)).rejects.toMatchObject({ status: 403 });
      expect(postsRepository.updatePost).not.toHaveBeenCalled();

      const result = await service.setHidden('p1', { userId: 'sa', role: 'super_admin' }, true);
      expect(result.hiddenAt).toBeInstanceOf(Date);
      expect(postsRepository.updatePost).toHaveBeenCalledWith('p1', { hiddenAt: result.hiddenAt });
    });

    it('이미 비공개인 글을 다시 비공개로 해도 처음 시각을 유지하고, 공개하면 비워야 한다', async () => {
      postsRepository.findById.mockResolvedValue({ id: 'p1', hiddenAt } as any);
      const sa = { userId: 'sa', role: 'super_admin' };
      await expect(service.setHidden('p1', sa, true)).resolves.toEqual({ hiddenAt });
      await expect(service.setHidden('p1', sa, false)).resolves.toEqual({ hiddenAt: null });
      expect(postsRepository.updatePost).toHaveBeenLastCalledWith('p1', { hiddenAt: null });
    });

    it('없는 글이면 404여야 한다', async () => {
      postsRepository.findById.mockResolvedValue(undefined as any);
      await expect(service.setHidden('nope', { userId: 'sa', role: 'super_admin' }, true)).rejects.toMatchObject({ status: 404 });
    });
  });
});
