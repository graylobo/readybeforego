jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));
import sharp from 'sharp';
import { UploadsService } from './uploads.service';

describe('UploadsService - 댓글 이미지 작은 버전', () => {
  let stored: Map<string, Buffer>;
  let provider: { upload: jest.Mock; delete: jest.Mock };
  let service: UploadsService;

  beforeEach(() => {
    stored = new Map();
    provider = {
      upload: jest.fn(async (buffer: Buffer, path: string) => {
        stored.set(path, buffer);
        return { url: `https://cdn/${path}`, path };
      }),
      delete: jest.fn(async (path: string) => {
        stored.delete(path);
      }),
    };
    service = new UploadsService(provider as any, {} as any);
  });

  const png = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#3a6' } }).png().toBuffer();

  describe('파일 크기 한도 (원본 30MB, 최적화 후 10MB)', () => {
    const MB = 1024 * 1024;

    it('원본이 10MB를 넘어도 최적화 후 10MB 이하면 저장한다', async () => {
      // 압축하지 않은 PNG라 원본은 10MB가 넘지만 WebP로 바꾸면 아주 작아진다
      const big = await sharp({ create: { width: 2000, height: 1900, channels: 3, background: '#3a6' } })
        .png({ compressionLevel: 0 })
        .toBuffer();
      expect(big.length).toBeGreaterThan(10 * MB);

      const result = await service.uploadImage(big, 'image/png', 'posts');

      expect(stored.get(result.path)!.length).toBeLessThan(10 * MB);
    });

    it('원본이 30MB를 넘으면 변환하지 않고 거절한다', async () => {
      await expect(service.uploadImage(Buffer.alloc(30 * MB + 1), 'image/png', 'posts')).rejects.toThrow('원본 최대 30MB');
      expect(provider.upload).not.toHaveBeenCalled();
    });

    it('최적화한 결과(변환에 실패하면 원본)가 10MB를 넘으면 거절한다', async () => {
      // 이미지가 아닌 데이터라 변환에 실패해 원본 크기 그대로 검사된다
      await expect(service.uploadImage(Buffer.alloc(11 * MB, 1), 'image/png', 'posts')).rejects.toThrow('최적화한 뒤에도');
      expect(provider.upload).not.toHaveBeenCalled();
    });
  });

  it('댓글 이미지는 440px 작은 버전을 같은 이름 + -w440 으로 함께 저장한다', async () => {
    const result = await service.uploadImage(await png(1600, 1000), 'image/png', 'comments', 'u1');

    const thumbPath = result.path.replace(/\.webp$/, '-w440.webp');
    expect(result.variantPaths).toEqual([thumbPath]);
    expect((await sharp(stored.get(thumbPath)!).metadata()).width).toBe(440);
  });

  it('원본이 440px 이하여도 작은 버전 이름의 파일을 만든다 (화면이 이 이름을 바로 쓰므로)', async () => {
    const result = await service.uploadImage(await png(300, 200), 'image/png', 'comments', 'u1');

    const thumbPath = result.path.replace(/\.webp$/, '-w440.webp');
    expect((await sharp(stored.get(thumbPath)!).metadata()).width).toBe(300);
  });

  it('움직이는 GIF도 프레임을 유지한 채 줄인다', async () => {
    const frames = await Promise.all(['#f00', '#0f0'].map((c) =>
      sharp({ create: { width: 1000, height: 600, channels: 3, background: c } }).png().toBuffer(),
    ));
    const gif = await sharp(frames, { join: { animated: true } }).gif().toBuffer();

    const result = await service.uploadImage(gif, 'image/gif', 'comments', 'u1');

    const meta = await sharp(stored.get(result.variantPaths[0])!, { animated: true }).metadata();
    expect(meta.width).toBe(440);
    expect(meta.pages).toBe(2);
  });

  it('댓글이 아닌 이미지(프로필 등)는 작은 버전을 만들지 않는다', async () => {
    const result = await service.uploadImage(await png(1600, 1000), 'image/png', 'profiles', 'u1');

    expect(result.variantPaths).toEqual([]);
    expect(stored.size).toBe(1);
  });

  it('댓글 이미지를 지우면 작은 버전도 함께 지운다', async () => {
    const result = await service.uploadImage(await png(1600, 1000), 'image/png', 'comments', 'u1');

    await service.deleteImage(result.path);

    expect(stored.size).toBe(0);
  });

  it('본문 이미지를 지울 때는 그 파일만 지운다 (작은 버전은 본문 주소로 따로 정리됨)', async () => {
    await service.deleteImage('posts/p1/a.webp');

    expect(provider.delete).toHaveBeenCalledTimes(1);
    expect(provider.delete).toHaveBeenCalledWith('posts/p1/a.webp');
  });
});

describe('UploadsService - 이모티콘', () => {
  let stored: Map<string, Buffer>;
  let provider: { upload: jest.Mock; move: jest.Mock; extractPathFromUrl: jest.Mock };
  let service: UploadsService;

  beforeEach(() => {
    stored = new Map();
    provider = {
      upload: jest.fn(async (buffer: Buffer, path: string) => {
        stored.set(path, buffer);
        return { url: `https://cdn/object/public/b/${path}`, path };
      }),
      move: jest.fn(async (from: string, to: string) => ({ url: `https://cdn/object/public/b/${to}`, path: to })),
      extractPathFromUrl: jest.fn((url: string) => url.match(/\/object\/public\/[^/]+\/(.+)$/)?.[1] ?? null),
    };
    service = new UploadsService(provider as any, {} as any);
  });

  const frame = (color: string, width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

  it('가로·세로를 480px 안으로 줄인다 (세로로 긴 이미지도)', async () => {
    const result = await service.uploadImage(await frame('#3a6', 600, 1200), 'image/png', 'temp', 'u1', { maxSize: 480 });

    const meta = await sharp(stored.get(result.path)!).metadata();
    expect([meta.width, meta.height]).toEqual([240, 480]);
  });

  it('움직이는 GIF는 프레임을 유지한 채 한 프레임 크기 기준으로 줄인다', async () => {
    const frames = await Promise.all(['#f00', '#0f0', '#00f'].map((c) => frame(c, 400, 300)));
    const gif = await sharp(frames, { join: { animated: true } }).gif().toBuffer();

    // 프레임 하나는 480px 안이라 줄이지 않는다 (전체 높이 900px로 잘못 보지 않는다)
    const result = await service.uploadImage(gif, 'image/gif', 'temp', 'u1', { maxSize: 480 });

    const meta = await sharp(stored.get(result.path)!, { animated: true }).metadata();
    expect([meta.width, meta.pageHeight, meta.pages]).toEqual([400, 300, 3]);
  });

  it('작성자가 temp에 올린 이미지를 영구 폴더로 옮긴 주소를 돌려준다', async () => {
    const url = await service.persistTempImage('https://cdn/object/public/b/temp/u1/a.webp?x=1', 'emoticons/u1', 'u1');

    expect(provider.move).toHaveBeenCalledWith('temp/u1/a.webp', 'emoticons/u1/a.webp');
    expect(url).toBe('https://cdn/object/public/b/emoticons/u1/a.webp');
  });

  it('이미 옮긴 이미지나 바깥 주소는 그대로, 다른 사용자의 temp 이미지는 거절한다', async () => {
    const kept = 'https://cdn/object/public/b/emoticons/u1/a.webp';
    await expect(service.persistTempImage(kept, 'emoticons/u1', 'u1')).resolves.toBe(kept);
    await expect(service.persistTempImage('https://example.com/a.gif', 'emoticons/u1', 'u1')).resolves.toBe('https://example.com/a.gif');
    await expect(
      service.persistTempImage('https://cdn/object/public/b/temp/u2/a.webp', 'emoticons/u1', 'u1'),
    ).rejects.toThrow('업로드한 이미지가 아닙니다');
    expect(provider.move).not.toHaveBeenCalled();
  });
});
