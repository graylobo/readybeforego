import { PointsService } from './points.service';

describe('PointsService.grantByAdmin', () => {
  it('사용 가능 포인트만 늘리고, 지급한 관리자를 내역에 남긴다', async () => {
    const tx = {};
    const repo = {
      transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      applyPointsDelta: jest.fn().mockResolvedValue({ availablePoints: 1500 }),
      insertPointHistory: jest.fn(),
    };
    const service = new PointsService(repo as any);

    const row = await service.grantByAdmin('user-1', 1000, '이벤트 당첨', 'admin-1');

    expect(row).toEqual({ availablePoints: 1500 });
    expect(repo.applyPointsDelta).toHaveBeenCalledWith('user-1', 0, 1000, tx);
    expect(repo.insertPointHistory).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        points: 1000,
        reason: '관리자 지급: 이벤트 당첨',
        relatedId: 'admin-1',
        relatedType: 'admin_grant',
      },
      tx,
    );
  });
});
