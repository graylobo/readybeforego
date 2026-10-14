import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  it('500 로그에 DB 오류의 실제 원인(cause)을 함께 남긴다', () => {
    const filter = new AllExceptionsFilter();
    const logged: string[] = [];
    (filter as any).logger = { error: (msg: string) => logged.push(msg), warn: jest.fn() };
    const json = jest.fn();
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => ({ status: () => ({ json }) }),
        getRequest: () => ({ url: '/posts', method: 'GET' }),
      }),
    };
    const cause = Object.assign(new Error('max clients reached in session mode'), { code: 'XX000' });
    filter.catch(new Error('Failed query: select 1', { cause }), host);
    expect(logged[0]).toContain('[원인: XX000 max clients reached in session mode] Failed query: select 1');
    expect(json.mock.calls[0][0].message).not.toContain('max clients');
  });
});
