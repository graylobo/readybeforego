import { getClientIp, pickForwardedIp } from './client-ip';

describe('client-ip', () => {
  const originalSecret = process.env.SSR_INTERNAL_SECRET;

  afterEach(() => {
    process.env.SSR_INTERNAL_SECRET = originalSecret;
  });

  describe('pickForwardedIp', () => {
    it('사용자가 꾸며 보낸 맨 앞 값이 아니라 프록시가 덧붙인 맨 뒤 값을 사용해야 한다', () => {
      // 사용자가 "X-Forwarded-For: 1.1.1.1"을 보내면 Cloud Run이 실제 IP를 뒤에 덧붙인다
      expect(pickForwardedIp('1.1.1.1, 203.0.113.7', '10.0.0.1', 1)).toBe('203.0.113.7');
    });

    it('믿을 프록시가 없으면(0) 헤더를 무시하고 접속 주소를 사용해야 한다', () => {
      expect(pickForwardedIp('1.1.1.1', '::ffff:10.0.0.1', 0)).toBe('10.0.0.1');
    });

    it('헤더가 없으면 접속 주소를 사용해야 한다', () => {
      expect(pickForwardedIp(undefined, '10.0.0.1', 1)).toBe('10.0.0.1');
    });
  });

  describe('getClientIp', () => {
    it('비밀값이 맞는 SSR 요청이면 X-Client-IP의 사용자 IP를 사용해야 한다', () => {
      process.env.SSR_INTERNAL_SECRET = 'ssr-secret';
      const req = {
        ip: '76.76.21.21',
        headers: { 'x-ssr-secret': 'ssr-secret', 'x-client-ip': '203.0.113.7' },
      };
      expect(getClientIp(req)).toBe('203.0.113.7');
    });

    it('비밀값이 틀리거나 서버에 설정되지 않았으면 X-Client-IP를 무시해야 한다', () => {
      process.env.SSR_INTERNAL_SECRET = 'ssr-secret';
      const forged = {
        ip: '198.51.100.9',
        headers: { 'x-ssr-secret': 'wrong', 'x-client-ip': '1.1.1.1' },
      };
      expect(getClientIp(forged)).toBe('198.51.100.9');

      delete process.env.SSR_INTERNAL_SECRET;
      expect(
        getClientIp({ ...forged, headers: { 'x-ssr-secret': '', 'x-client-ip': '1.1.1.1' } }),
      ).toBe('198.51.100.9');
    });
  });
});
