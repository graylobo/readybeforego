import type { RewriteInput } from '../interfaces/llm-provider.interface';

/** 댓글 지시문이 없을 때 쓰는 기본 댓글 문체 */
const DEFAULT_COMMENT_STYLE =
  '비속어, 유행어, 공감, 반박 등 실제 커뮤니티 댓글다운 짧고 맛깔나는 문체로 작성하십시오.';

/** 게시글 재작성 어조 규칙 (리라이팅 톤앤매너는 게시글에만 적용) */
export function buildToneRule(input: RewriteInput): string {
  return `5. 게시글 어조 설정: ${input.promptTone ? `지정된 톤(${input.promptTone})을 게시글 제목과 본문에 최대한 반영하십시오.` : '원본의 커뮤니티 구어체 톤을 유지하십시오.'}`;
}

/** 댓글 생성 규칙. 댓글을 만들지 않으면 빈 문자열 */
export function buildCommentsRule(input: RewriteInput): string {
  const count = input.commentsCount ?? 1;
  if (!input.generateComments || count <= 0) return '';
  const style = input.commentPromptTone?.trim()
    ? `댓글은 다음 지시를 따르십시오 (게시글 어조 설정과 별개로 댓글에만 적용): ${input.commentPromptTone.trim()}`
    : DEFAULT_COMMENT_STYLE;
  return `6. [댓글 자동 생성] 이 글에 어울리는 생생한 커뮤니티 반응 댓글을 **정확히 ${count}개**(절대 ${count}개를 초과하거나 미달하지 마십시오) 서로 다른 가상 닉네임과 함께 작성하십시오. ${style}`;
}
