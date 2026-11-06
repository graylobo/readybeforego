import { SupabaseStorageProvider } from './supabase-storage.provider';

// 폴더의 파일을 들고 있다가 list/remove 요청대로 돌려주고 지우는 가짜 저장소
function fakeStorage(fileCount: number, withSubfolder = false) {
  let files = Array.from({ length: fileCount }, (_, i) => ({ id: `f${i}`, name: `img-${i}.webp` }));
  const listCalls: number[] = [];
  const bucket = {
    list: jest.fn(async (_dir: string, opts?: { limit?: number }) => {
      const limit = opts?.limit ?? 100;
      listCalls.push(limit);
      const page = [...(withSubfolder ? [{ id: null, name: 'sub' }] : []), ...files].slice(0, limit);
      return { data: page, error: null };
    }),
    remove: jest.fn(async (paths: string[]) => {
      const names = new Set(paths.map((p) => p.split('/').pop()));
      files = files.filter((f) => !names.has(f.name));
      return { error: null };
    }),
  };
  return { client: { storage: { from: () => bucket } }, bucket, remaining: () => files.length, listCalls };
}

const makeProvider = (client: unknown) =>
  new SupabaseStorageProvider(client as any, { get: () => 'bucket' } as any);

describe('SupabaseStorageProvider.deleteDirectory', () => {
  it('파일이 100개를 넘어도(이미지가 많은 글) 폴더의 파일을 모두 지운다', async () => {
    const storage = fakeStorage(1500);
    await makeProvider(storage.client).deleteDirectory('posts/p1');
    expect(storage.remaining()).toBe(0);
    expect(storage.bucket.remove).toHaveBeenCalledTimes(2);
    expect(storage.bucket.remove.mock.calls[0][0][0]).toBe('posts/p1/img-0.webp');
  });

  it('하위 폴더 표시(id 없음)는 지울 파일로 보지 않고, 파일이 없으면 끝낸다', async () => {
    const storage = fakeStorage(0, true);
    await makeProvider(storage.client).deleteDirectory('posts/p1');
    expect(storage.bucket.remove).not.toHaveBeenCalled();
  });
});
