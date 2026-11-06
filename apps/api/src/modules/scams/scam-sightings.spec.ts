jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { ScamsController } from './scams.controller';
import { ScamsService } from './scams.service';

const KHAOSAN = { latitude: 13.759, longitude: 100.4972 };
const scamId = 'scam-1';
const today = new Date().toISOString().slice(0, 10);

function createService(scam: Record<string, unknown> | null) {
  const repository = {
    findById: jest.fn().mockResolvedValue(scam),
    findRegionById: jest.fn().mockResolvedValue(KHAOSAN),
    findCityById: jest.fn().mockResolvedValue({ latitude: 13.7563, longitude: 100.5018 }),
    upsertSighting: jest.fn().mockResolvedValue(undefined),
    deleteSighting: jest.fn().mockResolvedValue(undefined),
    findSightings: jest.fn().mockResolvedValue([]),
  };
  // 겪은 위치 기능은 저장소만 사용한다
  const service = Object.create(ScamsService.prototype) as ScamsService;
  (service as any).scamsRepository = repository;
  return { service, repository };
}

describe('겪은 위치 기록', () => {
  const regionScam = { id: scamId, regionId: 'region-1', reportType: 'CAUTION', deletedAt: null };

  it('좌표를 약 100m 단위로 낮춰 저장한다', async () => {
    const { service, repository } = createService(regionScam);
    await service.saveSighting(scamId, 'user-1', { latitude: 13.75934, longitude: 100.49756, seenOn: today });
    expect(repository.upsertSighting).toHaveBeenCalledWith(
      expect.objectContaining({ scamInfoId: scamId, userId: 'user-1', latitude: 13.759, longitude: 100.498, seenOn: today }),
    );
  });

  it('구역에서 5km보다 먼 위치는 거절한다', async () => {
    const { service, repository } = createService(regionScam);
    await expect(
      service.saveSighting(scamId, 'user-1', { latitude: 13.9, longitude: 100.4972, seenOn: today }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertSighting).not.toHaveBeenCalled();
  });

  it('도시 전체 주의사항은 도시에서 50km까지 받는다', async () => {
    const { service, repository } = createService({ ...regionScam, regionId: null, cityId: 'city-1' });
    await service.saveSighting(scamId, 'user-1', { latitude: 13.9, longitude: 100.5018, seenOn: today });
    expect(repository.upsertSighting).toHaveBeenCalled();
    await expect(
      service.saveSighting(scamId, 'user-1', { latitude: 15, longitude: 100.5018, seenOn: today }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('나라 전체 주의사항은 거리를 제한하지 않는다', async () => {
    const { service, repository } = createService({ ...regionScam, regionId: null, cityId: null, countryCode: 'TH' });
    await service.saveSighting(scamId, 'user-1', { latitude: 7.88, longitude: 98.39, seenOn: today });
    expect(repository.upsertSighting).toHaveBeenCalled();
  });

  it('미래 날짜와 없는 날짜를 거절한다', async () => {
    const { service } = createService(regionScam);
    for (const seenOn of ['2999-01-01', '2026-13-45']) {
      await expect(
        service.saveSighting(scamId, 'user-1', { ...KHAOSAN, seenOn }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('꿀팁과 삭제된 제보에는 기록할 수 없다', async () => {
    await expect(
      createService({ ...regionScam, reportType: 'TIP' }).service.saveSighting(scamId, 'user-1', { ...KHAOSAN, seenOn: today }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      createService({ ...regionScam, deletedAt: new Date() }).service.saveSighting(scamId, 'user-1', { ...KHAOSAN, seenOn: today }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      createService(null).service.saveSighting(scamId, 'user-1', { ...KHAOSAN, seenOn: today }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['saveSighting', 'deleteSighting'] as const)('%s는 로그인이 필요하다', (route) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ScamsController.prototype[route]);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, UserStatusGuard]));
  });
});
