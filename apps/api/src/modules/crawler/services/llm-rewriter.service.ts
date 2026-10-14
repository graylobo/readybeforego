import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import { LlmProvider, RewriteInput, RewriteResult } from '../interfaces/llm-provider.interface';
import {
  assignTokens,
  findMissingTokens,
  hasTokenResidue,
  PreservedTerm,
  protectHtml,
  protectText,
  restoreTerms,
} from '../utils/term-protection';

// 보존 단어가 사라지거나 토큰이 깨진 응답이면 다시 요청하는 최대 횟수 (첫 요청 포함)
const MAX_REWRITE_ATTEMPTS = 2;

export interface RewriteRequest extends Omit<RewriteInput, 'protectedTerms'> {
  // 보존 단어 (전체 공통 + 카드별을 합친 목록)
  preservedTerms?: PreservedTerm[];
}

@Injectable()
export class LlmRewriterService {
  private readonly logger = new Logger(LlmRewriterService.name);
  private selectedProvider: LlmProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly openaiProvider: OpenAIProvider,
  ) {
    const providerType = (this.configService.get<string>('LLM_PROVIDER') || '').toLowerCase();
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (providerType === 'openai' && openaiKey) {
      this.selectedProvider = this.openaiProvider;
      this.logger.log('LLM Provider initialized: OpenAI');
    } else if (providerType === 'gemini' && geminiKey) {
      this.selectedProvider = this.geminiProvider;
      this.logger.log('LLM Provider initialized: Gemini');
    } else if (geminiKey) {
      // 기본 fallback: Gemini
      this.selectedProvider = this.geminiProvider;
      this.logger.log('LLM Provider automatically selected: Gemini (fallback)');
    } else if (openaiKey) {
      this.selectedProvider = this.openaiProvider;
      this.logger.log('LLM Provider automatically selected: OpenAI (fallback)');
    } else {
      this.logger.warn('No LLM API keys found (GEMINI_API_KEY / OPENAI_API_KEY). Content rewriting will pass through original text.');
      this.selectedProvider = this.geminiProvider; // 기본 설정
    }
  }

  /**
   * 보존 단어를 토큰으로 치환해 LLM에 보내고, 응답을 검증한 뒤 원래 단어로 되돌린다.
   * 토큰이 사라지거나(다른 말로 바뀜) 깨지면 다시 요청하고, 끝내 실패하면 에러를 던져
   * 잘못 바뀐 글이 등록되지 않게 한다 (수집 측에서 실패로 기록되고 다음 수집 때 재시도된다).
   */
  async rewrite(request: RewriteRequest): Promise<RewriteResult> {
    const { preservedTerms, ...input } = request;
    const protectedTerms = assignTokens(preservedTerms ?? [], input.title, input.content);
    if (protectedTerms.length === 0) {
      return this.selectedProvider.rewrite(input);
    }

    const protectedInput: RewriteInput = {
      ...input,
      title: protectText(input.title, protectedTerms),
      content: protectHtml(input.content, protectedTerms),
      protectedTerms,
    };

    let lastProblem = '';
    for (let attempt = 1; attempt <= MAX_REWRITE_ATTEMPTS; attempt++) {
      const result = await this.selectedProvider.rewrite(protectedInput);

      const missing = findMissingTokens(`${result.title}\n${result.content}`, protectedTerms);
      const restored: RewriteResult = {
        title: restoreTerms(result.title, protectedTerms),
        content: restoreTerms(result.content, protectedTerms),
        comments: result.comments?.map((c) => ({
          nickname: restoreTerms(c.nickname, protectedTerms),
          content: restoreTerms(c.content, protectedTerms),
        })),
      };
      const hasResidue = [restored.title, restored.content, ...(restored.comments ?? []).flatMap((c) => [c.nickname, c.content])]
        .some(hasTokenResidue);

      if (missing.length === 0 && !hasResidue) {
        return restored;
      }

      lastProblem = missing.length > 0
        ? `보존 단어가 결과에서 사라짐: ${missing.map((t) => t.term).join(', ')}`
        : '보존 단어 표시가 깨진 채 응답됨';
      this.logger.warn(`Rewrite attempt ${attempt}/${MAX_REWRITE_ATTEMPTS} rejected (${lastProblem})`);
    }

    throw new Error(`패러프레이징 검증 실패 - ${lastProblem}`);
  }
}
