import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmUnavailableError, RewriteInput, RewriteResult } from '../interfaces/llm-provider.interface';
import { buildPreservationRules } from '../utils/term-protection';

@Injectable()
export class GeminiProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  // 429(Rate Limit) 또는 503(High Demand) 발생 시 자동 전환할 후보 모델 풀 (안정성 순)
  private readonly fallbackModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
  ];

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.defaultModel = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
  }

  async rewrite(input: RewriteInput): Promise<RewriteResult> {
    if (!this.apiKey) {
      throw new LlmUnavailableError('GEMINI_API_KEY가 설정되지 않음');
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

    // 설정된 기본 모델을 1순위로 하고, 나머지 후보 모델들을 순서대로 중복 없이 배치
    const candidateModels = [
      this.defaultModel,
      ...this.fallbackModels.filter((m) => m !== this.defaultModel),
    ];

    // 다중 모델 자동 폴백(Cascading Failover) 실행
    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${this.apiKey}`;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.8,
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.warn(
            `Gemini model [${currentModel}] error (${response.status}): ${errorText.slice(0, 150)}. Trying next model...`,
          );
          // 다음 모델로 전환
          continue;
        }

        const data = await response.json();
        const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJson) {
          this.logger.warn(`Gemini model [${currentModel}] returned empty text candidate. Trying next model...`);
          continue;
        }

        const parsed = this.extractJson(rawJson);
        // 제목·본문이 모두 있어야 한다 (하나라도 없으면 원문이 섞여 올라가므로 다음 모델로)
        if (!parsed || !parsed.title || !parsed.content) {
          this.logger.warn(`Gemini model [${currentModel}] JSON parsing failed. Trying next model...`);
          continue;
        }

        // 성공 로그 및 결과 반환
        return {
          title: parsed.title,
          content: parsed.content,
          comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        };
      } catch (err: any) {
        this.logger.warn(`Error invoking Gemini model [${currentModel}]: ${err.message}. Trying next model...`);
      }
    }

    // 모든 모델이 실패: 원문을 그대로 올리지 않도록 실패로 처리 (다음 수집 때 다시 시도)
    this.logger.error('All Gemini candidate models failed.');
    throw new LlmUnavailableError(`Gemini 모델 ${candidateModels.length}개 모두 실패 (자세한 원인은 서버 로그의 Gemini model 경고)`);
  }

  /**
   * 마크다운 백틱 및 불필요한 공백을 제거하고 안전하게 JSON을 파싱
   */
  private extractJson(raw: string): any {
    try {
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/i, '');
      }

      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }

      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }
}
