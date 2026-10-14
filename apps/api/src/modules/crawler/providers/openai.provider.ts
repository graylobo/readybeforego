import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmUnavailableError, RewriteInput, RewriteResult } from '../interfaces/llm-provider.interface';
import { buildPreservationRules } from '../utils/term-protection';

@Injectable()
export class OpenAIProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  async rewrite(input: RewriteInput): Promise<RewriteResult> {
    if (!this.apiKey) {
      throw new LlmUnavailableError('OPENAI_API_KEY가 설정되지 않음');
    }

    const targetCommentCount = input.commentsCount ?? 1;
    const commentsInstruction =
      input.generateComments && targetCommentCount > 0
        ? `6. [댓글 자동 생성] 이 글에 어울리는 생생한 커뮤니티 반응 댓글을 **정확히 ${targetCommentCount}개**(절대 ${targetCommentCount}개를 초과하거나 미달하지 마십시오) 서로 다른 가상 닉네임과 함께 작성하십시오. 비속어, 유행어, 공감, 반박 등 실제 커뮤니티 댓글다운 짧고 맛깔나는 문체로 작성하십시오.`
        : '';

    const commentExamples = Array.from(
      { length: Math.min(Math.max(targetCommentCount, 1), 3) },
      (_, i) => `    { "nickname": "가상닉네임${i + 1}", "content": "댓글 내용${i + 1}" }`,
    ).join(',\n');

    const jsonFormatInstruction =
      input.generateComments && targetCommentCount > 0
        ? `{
  "title": "재작성된 제목",
  "content": "재작성된 HTML 본문",
  "comments": [
${commentExamples}
  ]
}`
        : `{
  "title": "재작성된 제목",
  "content": "재작성된 HTML 본문"
}`;

    const systemPrompt = `당신은 커뮤니티 게시글 패러프레이징 전문 AI입니다.
목표: 원본 게시글의 핵심 내용, 흐름, 뉘앙스를 자연스럽게 살리면서, 원작성자가 검색했을 때 원문 문장과 100% 일치하지 않도록 제목과 문장 표현을 패러프레이징(재작성)합니다.

[중요 규칙]
1. 원본의 비속어, 은어, 드립, 반말 등 생생한 커뮤니티 감성은 억지로 순화하거나 검열하지 마십시오. 자연스럽게 어울리도록 유지하거나 재구성하십시오.
2. 제목은 원문의 재미와 핵심을 살리되, 단어 배열이나 문장 어투를 다르게 바꿔서 원작성자 검색 시 바로 드러나지 않게 하십시오.
3. 본문 내의 <img> 태그, <a> 태그 등 HTML 태그는 위치와 속성(src, href 등)을 절대로 누락하거나 변경하지 말고 그대로 보존하십시오.
4. 디시인사이드 광고 문구, 서명, 앱 다운로드 링크 등 불필요한 부가 텍스트는 제거하십시오.
5. 어조 설정: ${input.promptTone ? `지정된 톤(${input.promptTone})을 최대한 반영하십시오.` : '원본의 커뮤니티 구어체 톤을 유지하십시오.'}
${commentsInstruction}

${buildPreservationRules(input.protectedTerms)}

반드시 다음 JSON 형식으로만 응답하십시오:
${jsonFormatInstruction}`;

    const userPrompt = `[원본 제목]
${input.title}

[원본 본문 HTML]
${input.content}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.8,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenAI API error (${response.status}): ${errorText}`);
        throw new LlmUnavailableError(`OpenAI 응답 오류 (${response.status})`);
      }

      const data = await response.json();
      const rawJson = data?.choices?.[0]?.message?.content;
      if (!rawJson) {
        throw new LlmUnavailableError('OpenAI가 빈 응답을 보냄');
      }

      const parsed = JSON.parse(rawJson);
      if (!parsed?.title || !parsed?.content) {
        throw new LlmUnavailableError('OpenAI 응답에 제목/본문이 없음');
      }
      return {
        title: parsed.title,
        content: parsed.content,
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      };
    } catch (error) {
      if (error instanceof LlmUnavailableError) throw error;
      this.logger.error('Failed to rewrite content via OpenAI', error);
      // 네트워크 오류, JSON 파싱 실패 등: 원문을 그대로 올리지 않도록 실패로 처리
      throw new LlmUnavailableError(`OpenAI 호출 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
