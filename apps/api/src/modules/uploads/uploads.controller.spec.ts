jest.mock('uuid', () => ({ v4: () => '12345678-1234-1234-1234-123456789012' }));

import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

describe('UploadsController', () => {
  let controller: UploadsController;
  let uploadsService: { uploadImage: jest.Mock; deleteImage: jest.Mock; extractPathFromUrl: jest.Mock };
  const file = { buffer: Buffer.from('x'), mimetype: 'image/png' } as Express.Multer.File;
  const userReq = { user: { id: 'user-1', role: 'user' } };
  const guestReq = {};

  beforeEach(() => {
    uploadsService = {
      uploadImage: jest.fn().mockResolvedValue({ url: 'u', path: 'p' }),
      deleteImage: jest.fn().mockResolvedValue(undefined),
      extractPathFromUrl: jest.fn((url: string) => url),
    };
    controller = new UploadsController(uploadsService as unknown as UploadsService);
  });

  describe('uploadImage', () => {
    it('로그인 사용자는 {folder}/{userId}/ 경로로 업로드한다', async () => {
      await controller.uploadImage(file, userReq, 'comments');
      expect(uploadsService.uploadImage).toHaveBeenCalledWith(file.buffer, file.mimetype, 'comments', 'user-1', { responsive: false });
    });

    it('비로그인 사용자는 temp 폴더에만 업로드할 수 있다', async () => {
      await controller.uploadImage(file, guestReq, undefined);
      expect(uploadsService.uploadImage).toHaveBeenCalledWith(file.buffer, file.mimetype, 'temp', undefined, { responsive: false });
      await expect(controller.uploadImage(file, guestReq, 'comments')).rejects.toThrow();
    });

    it('본문 이미지(responsive=true)면 작은 버전 생성을 요청한다', async () => {
      await controller.uploadImage(file, guestReq, undefined, 'true');
      expect(uploadsService.uploadImage).toHaveBeenLastCalledWith(file.buffer, file.mimetype, 'temp', undefined, { responsive: true });
    });

    it('허용되지 않은 폴더는 거부한다', async () => {
      await expect(controller.uploadImage(file, userReq, 'internal')).rejects.toThrow();
      await expect(controller.uploadImage(file, userReq, '../etc')).rejects.toThrow();
      expect(uploadsService.uploadImage).not.toHaveBeenCalled();
    });
  });

  describe('deleteImage', () => {
    it('본인 경로의 파일은 삭제할 수 있다', async () => {
      await expect(controller.deleteImage('comments/user-1/a.webp', userReq)).resolves.toEqual({ success: true });
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('comments/user-1/a.webp');
    });

    it('다른 사용자나 소유자 없는 경로의 파일은 삭제할 수 없다', async () => {
      await expect(controller.deleteImage('comments/user-2/a.webp', userReq)).rejects.toThrow();
      await expect(controller.deleteImage('internal/a.webp', userReq)).rejects.toThrow();
      await expect(controller.deleteImage('comments/user-1/../user-2/a.webp', userReq)).rejects.toThrow();
      expect(uploadsService.deleteImage).not.toHaveBeenCalled();
    });

    it('관리자는 모든 파일을 삭제할 수 있다', async () => {
      await controller.deleteImage('internal/a.webp', { user: { id: 'admin', role: 'admin' } });
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('internal/a.webp');
    });
  });
});
