import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';
import { LlmUnavailableError } from '../interfaces/llm-provider.interface';

const input = { title: '원본 제목', content: '<p>원본 본문</p>', generateComments: true, commentsCount: 2 };
const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

describe('AI 재작성 실패 시 원문을 그대로 돌려주지 않는다', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('Gemini: 키가 없으면 실패', async () => {
    await expect(new GeminiProvider(config({})).rewrite(input)).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('Gemini: 모든 모델이 오류면 실패 (예전에는 원문 + (펌) + 고정 댓글)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ error: 'quota' }, 429));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(new GeminiProvider(config({ GEMINI_API_KEY: 'k' })).rewrite(input)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1); // 다른 모델도 시도한 뒤 실패
  });

  it('Gemini: 본문이 빠진 응답은 받지 않는다', async () => {
    const text = JSON.stringify({ title: '바뀐 제목' });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] })) as unknown as typeof fetch;
    await expect(new GeminiProvider(config({ GEMINI_API_KEY: 'k' })).rewrite(input)).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('Gemini: 정상 응답은 그대로 사용', async () => {
    const text = JSON.stringify({ title: '바뀐 제목', content: '<p>바뀐 본문</p>', comments: [{ nickname: 'a', content: 'b' }] });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] })) as unknown as typeof fetch;
    await expect(new GeminiProvider(config({ GEMINI_API_KEY: 'k' })).rewrite(input)).resolves.toMatchObject({ title: '바뀐 제목', content: '<p>바뀐 본문</p>' });
  });

  it('OpenAI: 키 없음 / 오류 응답 / 네트워크 오류 / 빈 응답은 모두 실패', async () => {
    await expect(new OpenAIProvider(config({})).rewrite(input)).rejects.toBeInstanceOf(LlmUnavailableError);
    const provider = new OpenAIProvider(config({ OPENAI_API_KEY: 'k' }));
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 500)) as unknown as typeof fetch;
    await expect(provider.rewrite(input)).rejects.toBeInstanceOf(LlmUnavailableError);
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
    await expect(provider.rewrite(input)).rejects.toBeInstanceOf(LlmUnavailableError);
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: '' } }] })) as unknown as typeof fetch;
    await expect(provider.rewrite(input)).rejects.toBeInstanceOf(LlmUnavailableError);
  });
});
