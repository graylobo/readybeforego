// 업로드 모듈이 쓰는 uuid(ESM)는 테스트에서 쓰지 않는다
jest.mock('uuid', () => ({ v4: () => 'x' }));
import { EmoticonsService } from './emoticons.service';

describe('EmoticonsService - 이미지 저장', () => {
  const temp = (name: string) => `https://cdn/temp/u1/${name}`;

  function setup() {
    const repo = {
      transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
      createPack: jest.fn((_userId: string, data: unknown) =>
        Promise.resolve({ id: 'p1', ...(data as object) }),
      ),
      createEmoticons: jest.fn(() => Promise.resolve()),
    };
    const uploads = {
      persistTempImage: jest.fn((url: string, folder: string) =>
        Promise.resolve(url.replace('/temp/u1/', `/${folder}/`)),
      ),
    };
    const service = new EmoticonsService(
      repo as never,
      {} as never,
      uploads as never,
    );
    return { service, repo, uploads };
  }

  it('temp 이미지를 emoticons/{작성자}/로 옮긴 주소로 저장하고, 대표 이미지와 겹치는 이미지는 한 번만 옮긴다', async () => {
    const { service, repo, uploads } = setup();
    const emoticons = ['a', 'b', 'c', 'd', 'e'].map((n, order) => ({
      url: temp(`${n}.webp`),
      order,
    }));

    await service.create('u1', {
      title: 't',
      price: 0,
      thumbnailUrl: temp('a.webp'),
      emoticons,
    });

    expect(uploads.persistTempImage).toHaveBeenCalledTimes(5);
    const [, packData] = repo.createPack.mock.calls[0];
    expect(packData).toMatchObject({
      thumbnailUrl: 'https://cdn/emoticons/u1/a.webp',
    });
    const [, items] = repo.createEmoticons.mock.calls[0] as unknown as [
      string,
      { url: string }[],
    ];
    expect(items.map((e) => e.url)).toEqual(
      ['a', 'b', 'c', 'd', 'e'].map(
        (n) => `https://cdn/emoticons/u1/${n}.webp`,
      ),
    );
  });
});
