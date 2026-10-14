import { ReportsService } from './reports.service';

describe('ReportsService - 신고 접수', () => {
  const makeService = (exists: boolean) => {
    const repo = {
      targetExists: jest.fn().mockResolvedValue(exists),
      hasUserReported: jest.fn().mockResolvedValue(false),
      createReport: jest.fn().mockResolvedValue({ id: 'r1' }),
    };
    return { service: new ReportsService(repo as any), repo };
  };
  const dto = { targetType: 'POST' as const, targetId: '00000000-0000-0000-0000-000000000001', reason: '스팸' };

  it('없거나 지워진 글/댓글은 신고를 받지 않아야 한다', async () => {
    const { service, repo } = makeService(false);

    await expect(service.createReport(dto as any, null)).rejects.toMatchObject({ status: 404 });
    expect(repo.createReport).not.toHaveBeenCalled();
  });

  it('있는 대상이면 접수해야 한다', async () => {
    const { service, repo } = makeService(true);

    await expect(service.createReport(dto as any, null)).resolves.toEqual({ id: 'r1' });
    expect(repo.createReport).toHaveBeenCalled();
  });
});
