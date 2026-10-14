import type { ProtectedTerm } from '../utils/term-protection';

export interface GeneratedComment {
  nickname: string;
  content: string;
}

export interface RewriteInput {
  title: string;
  content: string; // HTML content
  promptTone?: string | null;
  generateComments?: boolean;
  commentsCount?: number;
  // 토큰(⟦T1⟧)으로 치환된 보존 단어 목록. 프롬프트에 보존 규칙과 뜻 설명으로 들어간다
  protectedTerms?: ProtectedTerm[];
}

export interface RewriteResult {
  title: string;
  content: string;
  comments?: GeneratedComment[];
}

export interface LlmProvider {
  rewrite(input: RewriteInput): Promise<RewriteResult>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';

/**
 * AI로 글을 바꿔 쓰지 못했을 때 (키 없음, 모든 모델 실패, 응답 형식 오류 등).
 * 원문을 그대로 올리지 않도록 이 에러를 던지고, 수집 쪽은 그 글을 실패로 기록해 다음 수집 때 다시 시도한다.
 * AI 자체를 못 쓰는 상태라 이번 수집의 남은 글도 멈춘다 (계속 시도해도 똑같이 실패)
 */
export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}
