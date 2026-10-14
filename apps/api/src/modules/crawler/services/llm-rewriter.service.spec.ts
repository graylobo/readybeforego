import { ConfigService } from '@nestjs/config';
import { LlmRewriterService } from './llm-rewriter.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import {
  RewriteInput,
  RewriteResult,
} from '../interfaces/llm-provider.interface';
import {
  parsePreservedTerms,
  protectHtml,
  assignTokens,
  mergePreservedTerms,
} from '../utils/term-protection';

describe('보존 단어 보호', () => {
  describe('parsePreservedTerms', () => {
    it('쉼표/줄바꿈으로 나누고 "단어=뜻"을 해석하며 중복을 제거해야 한다', () => {
      expect(
        parsePreservedTerms('광상=광우상사, 잉여햄\n광붕이, 잉여햄,  '),
      ).toEqual([
        { term: '광상', meaning: '광우상사' },
        { term: '잉여햄' },
        { term: '광붕이' },
      ]);
    });
  });

  describe('mergePreservedTerms', () => {
    it('공통과 카드 단어를 합치고, 같은 단어는 카드 뜻을 우선하되 카드에 뜻이 없으면 공통 뜻을 써야 한다', () => {
      const common = parsePreservedTerms(
        'ㄹㅇ, 꼬라박다=크게 손해 보다, 광상=광산주',
      );
      const card = parsePreservedTerms('광상=광우상사, 꼬라박다, 광붕이');
      expect(mergePreservedTerms(common, card)).toEqual([
        { term: 'ㄹㅇ' },
        { term: '꼬라박다', meaning: '크게 손해 보다' },
        { term: '광상', meaning: '광우상사' },
        { term: '광붕이' },
      ]);
    });
  });

  describe('protectHtml', () => {
    it('태그 속성은 건드리지 않고 텍스트만 치환하며, 긴 단어를 먼저 치환해야 한다', () => {
      const terms = assignTokens(
        parsePreservedTerms('광상, 광상갤'),
        '광상갤 광상 <img alt="광상">',
      );
      const html = protectHtml(
        '<p>광상갤에서 광상 얘기</p><img src="https://x/광상.png">',
        terms,
      );
      expect(html).toBe(
        '<p>⟦T1⟧에서 ⟦T2⟧ 얘기</p><img src="https://x/광상.png">',
      );
    });
  });

  describe('LlmRewriterService.rewrite', () => {
    let service: LlmRewriterService;
    let provider: {
      rewrite: jest.Mock<Promise<RewriteResult>, [RewriteInput]>;
    };

    beforeEach(() => {
      provider = { rewrite: jest.fn<Promise<RewriteResult>, [RewriteInput]>() };
      const config = {
        get: (key: string) => (key === 'GEMINI_API_KEY' ? 'key' : undefined),
      };
      service = new LlmRewriterService(
        config as unknown as ConfigService,
        provider as unknown as GeminiProvider,
        {} as OpenAIProvider,
      );
    });

    const request = {
      title: '광상 주가 또 떨어짐',
      content: '<p>잉여햄 말이 맞았다 광상 망함</p>',
      preservedTerms: parsePreservedTerms('광상=광우상사, 잉여햄'),
    };

    it('보존 단어를 토큰으로 보내고, 응답의 토큰을 원래 단어로 되돌려야 한다', async () => {
      provider.rewrite.mockImplementation((input) => {
        // LLM은 원래 단어를 보지 못한다
        expect(input.title).not.toContain('광상');
        expect(input.content).not.toContain('잉여햄');
        expect(
          input.protectedTerms?.find((t) => t.term === '광상')?.meaning,
        ).toBe('광우상사');
        const [t1, t2] = input.protectedTerms!.map((t) => t.token);
        return Promise.resolve({
          title: `${t2} 주식 또 빠졌네`,
          content: `<p>${t1} 말대로 됐다 ${t2} 끝남</p>`,
          comments: [{ nickname: '눈팅족', content: `${t1} 예언 ㄷㄷ` }],
        });
      });

      const result = await service.rewrite(request);

      // 긴 단어부터 토큰 배정: T1=잉여햄(3자), T2=광상(2자)
      expect(result.title).toBe('광상 주식 또 빠졌네');
      expect(result.content).toBe('<p>잉여햄 말대로 됐다 광상 끝남</p>');
      expect(result.comments).toEqual([
        { nickname: '눈팅족', content: '잉여햄 예언 ㄷㄷ' },
      ]);
      expect(provider.rewrite).toHaveBeenCalledTimes(1);
    });

    it('토큰이 다른 단어로 바뀌면 다시 요청해야 한다', async () => {
      provider.rewrite
        .mockImplementationOnce(() =>
          Promise.resolve({
            title: '광산 주식 빠짐',
            content: '<p>백수형 말이 맞음</p>',
          }),
        )
        .mockImplementationOnce((input) => {
          const [t1, t2] = input.protectedTerms!.map((t) => t.token);
          return Promise.resolve({
            title: `${t2} 주식 빠짐`,
            content: `<p>${t1} 말이 맞음</p>`,
          });
        });

      const result = await service.rewrite(request);
      expect(result.content).toBe('<p>잉여햄 말이 맞음</p>');
      expect(provider.rewrite).toHaveBeenCalledTimes(2);
    });

    it('끝까지 보존 단어가 사라지면 등록되지 않도록 에러를 던져야 한다', async () => {
      provider.rewrite.mockResolvedValue({
        title: '광산 주식',
        content: '<p>백수형</p>',
      });
      await expect(service.rewrite(request)).rejects.toThrow(
        '보존 단어가 결과에서 사라짐: 잉여햄, 광상',
      );
      expect(provider.rewrite).toHaveBeenCalledTimes(2);
    });

    it('토큰이 깨진 채 응답되면 다시 요청해야 한다', async () => {
      provider.rewrite.mockImplementation((input) => {
        const [t1, t2] = input.protectedTerms!.map((t) => t.token);
        return Promise.resolve({
          title: `${t2} 주식`,
          content: `<p>${t1} ⟦T9⟧</p>`,
        });
      });
      await expect(service.rewrite(request)).rejects.toThrow(
        '보존 단어 표시가 깨진 채 응답됨',
      );
    });

    it('원문에 보존 단어가 없으면 그대로 전달해야 한다', async () => {
      provider.rewrite.mockResolvedValue({ title: 't', content: 'c' });
      await service.rewrite({
        title: '평범한 제목',
        content: '<p>본문</p>',
        preservedTerms: parsePreservedTerms('광상'),
      });
      expect(provider.rewrite).toHaveBeenCalledWith({
        title: '평범한 제목',
        content: '<p>본문</p>',
      });
    });
  });
});
