jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ScamsController } from './scams.controller';
import { UploadsService } from '../uploads/uploads.service';
import { ScamsService } from './scams.service';

const STORAGE = 'https://storage.test/object/public/images/';
const ownerImage = `${STORAGE}scams/owner/a.webp`;
const otherUserImage = `${STORAGE}scams/other/b.webp`;
const profileImage = `${STORAGE}profiles/other/c.webp`;

function createService(existingScam: Record<string, unknown> = {}) {
  const storageProvider = {
    extractPathFromUrl: (url: string) => url.match(/\/object\/public\/[^/]+\/(.+)$/)?.[1] ?? null,
    getPublicUrl: (path: string) => `${STORAGE}${path}`,
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const uploadsService = new UploadsService(storageProvider as any, {} as any);
  const repository = {
    findById: jest.fn().mockResolvedValue({ id: 's1', userId: 'owner', imageUrls: [], ...existingScam }),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({ id: 's1' }),
    transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
    findCommentImagesByScam: jest.fn().mockResolvedValue([]),
    softDeleteCommentsByScam: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ScamsService(repository as any, uploadsService);
  return { service, repository, storageProvider };
}

const createDto = (imageUrls: string[]) =>
  ({ scope: 'country', countryCode: 'TH', title: 't', description: 'd', scamCategory: 'OTHER', otherCategoryNote: '기타 내용', imageUrls }) as any;

describe('제보 사진 소유 확인', () => {
  it('본인이 올린 사진만 첨부할 수 있다', async () => {
    const { service, repository } = createService();
    await service.create(createDto([ownerImage]), 'owner');
    expect(repository.create).toHaveBeenCalled();
  });

  it.each([
    ['다른 사용자의 사진', otherUserImage],
    ['제보 폴더가 아닌 파일', `${STORAGE}profiles/owner/c.webp`],
    ['같은 경로의 외부 주소', 'https://evil.test/object/public/images/scams/owner/a.webp'],
    ['외부 이미지', 'https://evil.test/track.gif'],
    ['경로 이동', `${STORAGE}scams/owner/../other/b.webp`],
  ])('%s는 거절한다', async (_name, url) => {
    const { service } = createService();
    await expect(service.create(createDto([url]), 'owner')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('수정할 때 이미 붙어 있던 사진은 유지할 수 있지만 새로 다른 사람 사진을 넣을 수는 없다', async () => {
    const { service, repository } = createService({ imageUrls: [ownerImage] });
    await service.update('s1', { imageUrls: [ownerImage] } as any, 'admin', 'super_admin');
    expect(repository.update).toHaveBeenCalled();
    await expect(
      service.update('s1', { imageUrls: [ownerImage, otherUserImage] } as any, 'owner', 'user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('수정에서 뺀 사진은 작성자 파일일 때만 저장소에서 지운다', async () => {
    const { service, storageProvider } = createService({ imageUrls: [ownerImage, otherUserImage, profileImage] });
    await service.update('s1', { imageUrls: [] } as any, 'owner', 'user');
    // 원본과 함께 저장한 작은 버전까지만 지운다
    expect(storageProvider.delete.mock.calls.map(([path]) => path).sort()).toEqual([
      'scams/owner/a-w720.webp',
      'scams/owner/a.webp',
    ]);
  });

  it('사용자가 제보를 지워도 사진은 복원을 위해 남겨 둔다', async () => {
    const { service, storageProvider } = createService({ imageUrls: [ownerImage] });
    await service.delete('s1', 'owner', 'user');
    expect(storageProvider.delete).not.toHaveBeenCalled();
  });

  it('반응은 로그인해야 남길 수 있다', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ScamsController.prototype.toggleReaction);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard]));
  });

  it('지운 지 30일이 지난 제보만 사진과 함께 영구 삭제한다', async () => {
    const { service, repository, storageProvider } = createService({ imageUrls: [ownerImage], deletedAt: new Date() });
    (repository as any).findDeletedBefore = jest.fn().mockResolvedValue([{ id: 's1' }]);
    (repository as any).deleteAdminScam = jest.fn().mockResolvedValue({ id: 's1' });
    const now = new Date('2026-12-01T00:00:00Z');

    await expect(service.purgeExpiredDeletedScams(now)).resolves.toEqual({ foundCount: 1, purgedCount: 1 });

    expect((repository as any).findDeletedBefore).toHaveBeenCalledWith(new Date('2026-11-01T00:00:00Z'));
    expect((repository as any).deleteAdminScam).toHaveBeenCalledWith('s1');
    expect(storageProvider.delete).toHaveBeenCalledWith('scams/owner/a.webp');
  });

  it('영구 삭제 중 하나가 실패해도 나머지를 계속 지운다', async () => {
    const { service, repository } = createService();
    (repository as any).findDeletedBefore = jest.fn().mockResolvedValue([{ id: 'bad' }, { id: 'good' }]);
    (repository as any).deleteAdminScam = jest.fn(async (id: string) => {
      if (id === 'bad') throw new Error('fail');
      return { id };
    });
    await expect(service.purgeExpiredDeletedScams()).resolves.toEqual({ foundCount: 2, purgedCount: 1 });
  });
});
