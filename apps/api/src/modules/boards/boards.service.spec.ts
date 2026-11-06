import { BoardsService } from './boards.service';

describe('BoardsService - 게시판 삭제', () => {
  const makeService = (livePostCount: number) => {
    const repo = {
      countLivePosts: jest.fn().mockResolvedValue(livePostCount),
      deleteBoard: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new BoardsService(repo as any, {} as any), repo };
  };

  it('게시글이 남아 있는 게시판은 삭제하지 않아야 한다 (글이 함께 사라지고 이미지는 저장소에 남음)', async () => {
    const { service, repo } = makeService(3);

    await expect(service.delete('board1')).rejects.toMatchObject({ status: 409 });
    expect(repo.deleteBoard).not.toHaveBeenCalled();
  });

  it('게시글이 없으면 삭제해야 한다', async () => {
    const { service, repo } = makeService(0);

    await expect(service.delete('board1')).resolves.toBe(true);
    expect(repo.deleteBoard).toHaveBeenCalledWith('board1');
  });

  it('이미 있는 주소로 게시판을 만들면 409 (DB 오류 500 대신)', async () => {
    const repo = { findBySlug: jest.fn().mockResolvedValue({ id: 'b1', slug: 'free' }), insertBoard: jest.fn() };
    const service = new BoardsService(repo as any, {} as any);

    await expect(service.create({ slug: 'free', name: '자유' })).rejects.toMatchObject({ status: 409 });
    expect(repo.insertBoard).not.toHaveBeenCalled();
  });
});

describe('BoardsService - 전체 게시판', () => {
  it('이름·설명·화면 형식은 사이트 설정 값을 쓰고, 글은 쓸 수 없어야 한다', async () => {
    const settings = { getSettings: jest.fn().mockResolvedValue({ allBoardName: '모든 글', allBoardDescription: '설명', allBoardViewMode: 'lounge' }) };
    const service = new BoardsService({} as any, settings as any);

    await expect(service.findBySlug('all')).resolves.toMatchObject({
      slug: 'all', name: '모든 글', description: '설명', viewMode: 'lounge', isReadOnly: true,
    });
  });
});
