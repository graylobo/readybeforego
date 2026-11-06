import { RealtimeService } from './realtime.service';

const make = (env: Record<string, string | undefined>) =>
  new RealtimeService({ get: (key: string) => env[key] } as any);

const SUPABASE = {
  REALTIME_PROVIDER: 'supabase',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_ANON_KEY: 'anon.jwt.key',
  SUPABASE_SERVICE_KEY: 'service.jwt.key',
};

describe('RealtimeService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('설정이 없으면 API 서버 연결 방식이고, 보내기는 아무 일도 하지 않는다', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = make({});
    expect(service.publicConfig()).toEqual({ provider: 'server' });
    await service.broadcast('chat:lobby', 'message', {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('키가 하나라도 없으면 Supabase를 쓰지 않는다 (잘못된 설정으로 채팅이 멈추지 않게)', () => {
    expect(make({ ...SUPABASE, SUPABASE_ANON_KEY: undefined }).publicConfig()).toEqual({ provider: 'server' });
  });

  it('Supabase 프로젝트 주소로 접속 정보를 만들고, 비공개 채널로 service 키를 써서 보낸다', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    const service = make(SUPABASE);
    expect(service.publicConfig()).toEqual({ provider: 'supabase', url: 'wss://abc.supabase.co/realtime/v1', anonKey: 'anon.jwt.key' });

    await service.broadcast('chat:lobby', 'message', { id: 'm1' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://abc.supabase.co/realtime/v1/api/broadcast');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer service.jwt.key');
    expect(JSON.parse(init.body as string)).toEqual({ messages: [{ topic: 'chat:lobby', event: 'message', payload: { id: 'm1' }, private: true }] });
  });

  it('보내기가 실패해도 예외를 던지지 않는다 (메시지는 이미 저장됨)', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(make(SUPABASE).broadcast('chat:lobby', 'message', {})).resolves.toBeUndefined();
  });

  it('알림 채널 이름은 회원 id가 드러나지 않고, 같은 회원이면 항상 같다', () => {
    const service = make(SUPABASE);
    const topic = service.notificationTopic('user-1');
    expect(topic).toMatch(/^notify:[A-Za-z0-9_-]{32}$/);
    expect(topic).not.toContain('user-1');
    expect(service.notificationTopic('user-1')).toBe(topic);
    expect(service.notificationTopic('user-2')).not.toBe(topic);
  });
});
