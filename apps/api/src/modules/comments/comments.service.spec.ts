import { BoardManagersService } from '../boards/board-managers.service';
import { isAdmin } from '@community/shared-types';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { ErrorCode } from '@community/shared-types';
import { CommentsService } from './comments.service';
import { CommentsRepository } from './comments.repository';
import { UploadsService } from '../uploads/uploads.service';

jest.mock('uuid', () => ({ v4: () => '12345678-1234-1234-1234-123456789012' }));

describe('CommentsService - 비회원 댓글 비밀번호', () => {
  let service: CommentsService;
  let commentsRepository: jest.Mocked<CommentsRepository>;
  let uploadsService: jest.Mocked<UploadsService>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    const mockCommentsRepository = {
      transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({})),
      createComment: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({
          id: 'comment-1', likeCount: 0, dislikeCount: 0, deletedAt: null,
          createdAt: new Date(), updatedAt: new Date(), ...data,
        }),
      ),
      updatePostCommentCount: jest.fn().mockResolvedValue(1),
      recountPostCommentCount: jest.fn().mockResolvedValue(0),
      softDeleteComment: jest.fn().mockResolvedValue(true),
      hardDeleteComment: jest.fn(),
      findThread: jest.fn().mockResolvedValue([]),
      findUserById: jest.fn(),
      findById: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      updateComment: jest.fn(),
      findCommentsByTarget: jest.fn().mockResolvedValue([]),
      findUserReactionsByTarget: jest.fn().mockResolvedValue([]),
      findPostAccess: jest.fn().mockResolvedValue({ userId: 'owner', isPrivate: false, allowComments: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: CommentsRepository, useValue: mockCommentsRepository },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        // 실제와 같이 사이트 관리자는 모든 게시판을 관리할 수 있다 (게시판 매니저 여부는 테스트마다 바꿔 씀)
        { provide: BoardManagersService, useValue: { canModerate: jest.fn(async (_boardId: string, v: { userId?: string; role?: string }) => !!v.userId && isAdmin(v.role as any)) } },
        {
          provide: UploadsService,
          useValue: {
            extractPathFromUrl: jest.fn((url: string) => url.replace('https://cdn/', '')),
            extractCommentImagePath: jest.fn((url: string) => {
              const path = url.replace('https://cdn/', '');
              return path.startsWith('comments/') ? path : null;
            }),
            deleteImage: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(CommentsService);
    commentsRepository = module.get(CommentsRepository);
    uploadsService = module.get(UploadsService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('비밀번호를 bcrypt 해시로 저장하고, 응답에는 해시를 포함하지 않아야 한다', async () => {
    const result = await service.create({ ipAddress: '203.0.113.7' }, {
      targetType: 'post',
      targetId: 'post-1',
      content: '비회원 댓글',
      guestName: '익명',
      guestPassword: '1234',
    });

    const saved = commentsRepository.createComment.mock.calls[0][0];
    expect(saved.guestPassword).not.toBe('1234');
    expect(saved.guestPassword).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare('1234', saved.guestPassword)).resolves.toBe(true);
    expect(result.comment).not.toHaveProperty('guestPassword');
  });

  describe('update', () => {
    beforeEach(async () => {
      commentsRepository.findById.mockResolvedValue({
        id: 'comment-1',
        userId: null,
        guestPassword: await bcrypt.hash('1234', 4),
      } as any);
      commentsRepository.updateComment.mockResolvedValue({
        id: 'comment-1',
        content: '수정됨',
        guestPassword: 'stored-hash',
      } as any);
    });

    it('비밀번호가 맞으면 수정되고, 응답에는 해시를 포함하지 않아야 한다', async () => {
      const result = await service.update('comment-1', {}, {
        content: '수정됨',
        guestPassword: '1234',
      });
      expect(commentsRepository.updateComment).toHaveBeenCalled();
      expect(result).not.toHaveProperty('guestPassword');
    });

    it('비밀번호가 틀리면 COMMENT_INVALID_PASSWORD를 던져야 한다', async () => {
      await expect(
        service.update('comment-1', {}, { content: '수정됨', guestPassword: '0000' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ErrorCode.COMMENT_INVALID_PASSWORD }),
      });
      expect(commentsRepository.updateComment).not.toHaveBeenCalled();
    });
  });

  it('관리자는 다른 회원의 댓글도 수정할 수 있어야 한다', async () => {
    commentsRepository.findById.mockResolvedValue({ id: 'c1', userId: 'someone', guestPassword: null } as any);
    commentsRepository.updateComment.mockResolvedValue({ id: 'c1', content: 'x' } as any);

    await service.update('c1', { userId: 'admin1', role: 'admin' }, { content: 'x' });
    expect(commentsRepository.updateComment).toHaveBeenCalled();

    await expect(service.update('c1', { userId: 'other', role: 'user' }, { content: 'x' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('없는 게시글에는 댓글을 달 수 없어야 한다', async () => {
    commentsRepository.findPostAccess.mockResolvedValue(undefined as any);
    await expect(
      service.create({}, { targetType: 'post', targetId: 'missing', content: 'x', guestPassword: '1' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(commentsRepository.createComment).not.toHaveBeenCalled();
  });

  describe('create', () => {
    it('목록과 같은 형태로 돌려주고, 비회원 이름이 없으면 IP 앞 두 자리를 쓴다', async () => {
      const result = await service.create({ ipAddress: '203.0.113.7' }, { targetType: 'post', targetId: 'p1', content: '안녕', guestPassword: '5678' });
      expect(result.commentCount).toBe(1);
      expect(result.comment).toMatchObject({
        content: '안녕', guestName: '203.0', ipAddress: '203.0', isDeleted: false,
        upvoteCount: 0, isUpvoted: false, replies: [],
      });
    });

    it('비회원 댓글도 작성 알림 이벤트를 보내야 한다 (글쓴이/원댓글 작성자에게 알림)', async () => {
      await service.create({ ipAddress: '203.0.113.7' }, { targetType: 'post', targetId: 'p1', content: '손님', guestPassword: '5678' });
      const event = eventEmitter.emit.mock.calls.find(([name]) => name === 'comment.created')?.[1];
      expect(event).toMatchObject({ userId: null, targetId: 'p1' });
    });

    it('비회원 댓글은 비밀번호가 없으면 거절해야 한다 (비밀번호 없이는 수정/삭제할 수 없음)', async () => {
      await expect(
        service.create({ ipAddress: '203.0.113.7' }, { targetType: 'post', targetId: 'p1', content: '안녕' }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('댓글 내용은 글자 그대로 저장해야 한다 (&, < 가 &amp; 처럼 바뀌지 않음)', async () => {
      await service.create({ userId: 'u1' }, { targetType: 'post', targetId: 'p1', content: 'Tom & Jerry <3' });
      expect(commentsRepository.createComment.mock.calls[0][0].content).toBe('Tom & Jerry <3');
    });

    it('본인이 올린 댓글 이미지가 아니면 첨부할 수 없어야 한다 (다른 사람 파일을 지우게 하는 것 방지)', async () => {
      await expect(
        service.create({ userId: 'u1' }, { targetType: 'post', targetId: 'p1', imageUrl: 'https://cdn/profiles/u2/me.webp' }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.create({ userId: 'u1' }, { targetType: 'post', targetId: 'p1', imageUrl: 'https://cdn/comments/u2/a.webp' }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.create({ userId: 'u1' }, { targetType: 'post', targetId: 'p1', imageUrl: 'https://cdn/comments/u1/a.webp' }),
      ).resolves.toBeDefined();
    });

    it('비공개 게시판 글에는 작성자/관리자만 댓글을 달 수 있어야 한다', async () => {
      commentsRepository.findPostAccess.mockResolvedValue({ userId: 'owner', isPrivate: true, allowComments: true } as any);
      await expect(service.create({}, { targetType: 'post', targetId: 'p1', content: 'x' })).rejects.toMatchObject({ status: 401 });
      await expect(service.create({ userId: 'other', role: 'user' }, { targetType: 'post', targetId: 'p1', content: 'x' })).rejects.toMatchObject({ status: 403 });
      await expect(service.create({ userId: 'owner' }, { targetType: 'post', targetId: 'p1', content: 'x' })).resolves.toBeDefined();
    });

    it('다른 글의 댓글이나 없는 댓글에는 답글을 달 수 없어야 한다', async () => {
      commentsRepository.findById.mockResolvedValue({ id: 'c9', targetType: 'post', targetId: 'other-post' } as any);
      await expect(
        service.create({ userId: 'u1' }, { targetType: 'post', targetId: 'p1', parentId: 'c9', content: 'x' }),
      ).rejects.toMatchObject({ status: 404 });
      commentsRepository.findById.mockResolvedValue(undefined);
      await expect(
        service.create({ userId: 'u1' }, { targetType: 'post', targetId: 'p1', parentId: 'c9', content: 'x' }),
      ).rejects.toMatchObject({ status: 404 });
      expect(commentsRepository.createComment).not.toHaveBeenCalled();
    });

    it('게시글이 아닌 대상에는 댓글을 달 수 없어야 한다', async () => {
      await expect(service.create({ userId: 'u1' }, { targetType: 'user', targetId: 'p1', content: 'x' })).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('getCommentsByTarget', () => {
    const baseComment = {
      targetId: 'p1',
      targetType: 'post',
      parentId: null,
      content: '댓글',
      deletedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    it('저장된 추천 수와 내 반응을 쓰고, 작성자 IP는 앞 두 자리만 보여줘야 한다', async () => {
      commentsRepository.findCommentsByTarget.mockResolvedValue([
        { ...baseComment, id: 'c1', userId: null, ipAddress: '203.0.113.7', likeCount: 4, dislikeCount: 1 },
        { ...baseComment, id: 'c2', userId: 'u2', ipAddress: '198.51.100.2', likeCount: 0, dislikeCount: 0, user: { name: 'n' } },
      ] as any);
      commentsRepository.findUserReactionsByTarget.mockResolvedValue([{ commentId: 'c1', type: 'like' }] as any);

      const result = await service.getCommentsByTarget('post', 'p1', { userId: 'u1' });
      const [c1, c2] = result.comments;

      expect(c1).toMatchObject({ upvoteCount: 4, downvoteCount: 1, isUpvoted: true, ipAddress: '203.0' });
      expect(c2.ipAddress).toBeNull();
    });

    it('비공개 게시판 글의 댓글은 작성자/관리자만 볼 수 있어야 한다', async () => {
      commentsRepository.findPostAccess.mockResolvedValue({ userId: 'owner', isPrivate: true } as any);

      await expect(service.getCommentsByTarget('post', 'p1', {})).rejects.toMatchObject({ status: 401 });
      await expect(service.getCommentsByTarget('post', 'p1', { userId: 'other', role: 'user' })).rejects.toMatchObject({ status: 403 });
      await expect(service.getCommentsByTarget('post', 'p1', { userId: 'owner' })).resolves.toBeDefined();
      await expect(service.getCommentsByTarget('post', 'p1', { userId: 'a', role: 'admin' })).resolves.toBeDefined();
    });

    it('비공개 처리한 글의 댓글은 Super Admin만 볼 수 있고, 다른 사람에게는 404여야 한다', async () => {
      commentsRepository.findPostAccess.mockResolvedValue({ userId: 'owner', isPrivate: false, hiddenAt: new Date() } as any);

      await expect(service.getCommentsByTarget('post', 'p1', {})).rejects.toMatchObject({ status: 404 });
      await expect(service.getCommentsByTarget('post', 'p1', { userId: 'owner', role: 'user' })).rejects.toMatchObject({ status: 404 });
      await expect(service.getCommentsByTarget('post', 'p1', { userId: 'a', role: 'admin' })).rejects.toMatchObject({ status: 404 });
      await expect(service.getCommentsByTarget('post', 'p1', { userId: 'sa', role: 'super_admin' })).resolves.toBeDefined();
    });
  });

  describe('remove (댓글 수)', () => {
    const memberComment = { id: 'c1', userId: 'u1', targetType: 'post', targetId: 'p1', deletedAt: null };
    const superAdmin = { userId: 'sa', role: 'super_admin' };

    it.each([
      ['작성자 본인', { userId: 'u1', role: 'user' }],
      ['관리자(admin)', { userId: 'ad', role: 'admin' }],
      ['비회원', {}],
    ])('완전 삭제는 Super Admin만 (%s는 거절)', async (_label, viewer) => {
      commentsRepository.findById.mockResolvedValue(memberComment as any);
      commentsRepository.findByIdIncludingDeleted.mockResolvedValue(memberComment as any);

      await expect(service.remove('c1', viewer as any, undefined, 'hard')).rejects.toMatchObject({ status: 403 });
      expect(commentsRepository.hardDeleteComment).not.toHaveBeenCalled();
    });

    it("Super Admin은 이미 삭제된 댓글('삭제된 댓글입니다')도 완전 삭제할 수 있다", async () => {
      commentsRepository.findById.mockResolvedValue(undefined);
      commentsRepository.findByIdIncludingDeleted.mockResolvedValue({ ...memberComment, deletedAt: new Date() } as any);
      commentsRepository.findThread.mockResolvedValue([{ id: 'c1', userId: 'u1', imageUrl: null, isDeleted: true }]);

      await service.remove('c1', superAdmin, undefined, 'hard');

      expect(commentsRepository.hardDeleteComment).toHaveBeenCalledWith('c1', expect.anything());
      // 삭제할 때 이미 회수한 포인트는 다시 회수하지 않는다
      expect(eventEmitter.emit.mock.calls.some(([name]) => name === 'points.revoke')).toBe(false);
    });

    it('이미 삭제된 댓글이면(동시에 두 번 삭제) 댓글 수를 줄이지 않아야 한다', async () => {
      commentsRepository.findById.mockResolvedValue(memberComment as any);
      commentsRepository.softDeleteComment.mockResolvedValue(false);

      await service.remove('c1', { userId: 'u1' });

      expect(commentsRepository.updatePostCommentCount).not.toHaveBeenCalled();
    });

    it('완전 삭제는 답글까지 지워지므로 1을 빼지 않고 남은 댓글을 다시 세야 한다', async () => {
      commentsRepository.findByIdIncludingDeleted.mockResolvedValue(memberComment as any);

      await service.remove('c1', superAdmin, undefined, 'hard');

      expect(commentsRepository.recountPostCommentCount).toHaveBeenCalledWith('p1', expect.anything());
      expect(commentsRepository.updatePostCommentCount).not.toHaveBeenCalled();
    });

    it('완전 삭제하면 함께 지워지는 답글의 첨부 이미지도 스토리지에서 지워야 한다', async () => {
      commentsRepository.findByIdIncludingDeleted.mockResolvedValue({ ...memberComment, imageUrl: 'https://cdn/comments/u1/a.webp' } as any);
      commentsRepository.findThread.mockResolvedValue([
        { id: 'c1', userId: 'u1', imageUrl: 'https://cdn/comments/u1/a.webp', isDeleted: false },
        { id: 'r1', userId: 'u2', imageUrl: 'https://cdn/comments/u2/reply.webp', isDeleted: false },
        { id: 'r2', userId: 'u3', imageUrl: null, isDeleted: true },
      ]);

      await service.remove('c1', superAdmin, undefined, 'hard');

      expect(uploadsService.deleteImage).toHaveBeenCalledWith('comments/u1/a.webp');
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('comments/u2/reply.webp');
    });

    it('완전 삭제하면 함께 지워지는 댓글들로 받은 포인트를 회수해야 한다 (이미 지워졌던 답글은 제외)', async () => {
      commentsRepository.findByIdIncludingDeleted.mockResolvedValue(memberComment as any);
      commentsRepository.findThread.mockResolvedValue([
        { id: 'c1', userId: 'u1', imageUrl: null, isDeleted: false },
        { id: 'r1', userId: 'u2', imageUrl: null, isDeleted: false },
        { id: 'r2', userId: 'u3', imageUrl: null, isDeleted: true },
        { id: 'r3', userId: null, imageUrl: null, isDeleted: false },
      ]);

      await service.remove('c1', superAdmin, undefined, 'hard');

      const revoked = eventEmitter.emit.mock.calls.filter(([name]) => name === 'points.revoke').map(([, e]: any[]) => `${e.userId}:${e.relatedId}`);
      expect(revoked).toEqual(['u1:c1', 'u2:r1']);
    });

    it('이미 지워진 댓글을 다시 지우면(동시 요청) 포인트를 두 번 회수하지 않아야 한다', async () => {
      commentsRepository.findById.mockResolvedValue(memberComment as any);
      commentsRepository.softDeleteComment.mockResolvedValue(false);

      await service.remove('c1', { userId: 'u1' });

      expect(eventEmitter.emit.mock.calls.some(([name]) => name === 'points.revoke')).toBe(false);
    });

    it('삭제 표시(soft)는 답글이 남으므로 이 댓글의 이미지만 지워야 한다', async () => {
      commentsRepository.findById.mockResolvedValue({ ...memberComment, imageUrl: 'https://cdn/comments/u1/a.webp' } as any);

      await service.remove('c1', { userId: 'u1' });

      expect(commentsRepository.findThread).not.toHaveBeenCalled();
      expect(uploadsService.deleteImage).toHaveBeenCalledTimes(1);
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('comments/u1/a.webp');
    });
  });
});
