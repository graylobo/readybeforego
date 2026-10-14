/**
 * 보존 단어 보호: LLM이 맥락을 몰라 줄임말·닉네임·은어를 바꾸지 못하도록,
 * 보내기 전에 보존 단어를 토큰(⟦T1⟧)으로 치환하고 응답을 받은 뒤 원래 단어로 되돌린다.
 * LLM은 원래 글자를 보지 못하므로 바꿀 수 없고, 토큰이 사라지거나 깨지면 검증에서 걸러낸다.
 */

import { parsePreservedTerms } from '@community/shared-types';
import type { PreservedTerm } from '@community/shared-types';

// 파싱 규칙은 관리자 화면 미리보기와 공유하기 위해 shared-types에 있다
export { parsePreservedTerms };
export type { PreservedTerm };

export interface ProtectedTerm extends PreservedTerm {
  token: string;
}

const TOKEN_OPEN = '⟦';
const TOKEN_CLOSE = '⟧';
const TOKEN_PATTERN = /⟦T(\d+)⟧/g;

/**
 * 전체 공통 보존 단어와 카드별 보존 단어를 합친다.
 * 같은 단어가 양쪽에 있으면 카드 쪽 뜻을 우선하고, 카드에 뜻이 없으면 공통 쪽 뜻을 사용한다.
 */
export function mergePreservedTerms(
  common: PreservedTerm[],
  card: PreservedTerm[],
): PreservedTerm[] {
  const merged = new Map<string, PreservedTerm>();
  for (const t of common) merged.set(t.term, t);
  for (const t of card) {
    const meaning = t.meaning ?? merged.get(t.term)?.meaning;
    merged.set(t.term, meaning ? { term: t.term, meaning } : { term: t.term });
  }
  return [...merged.values()];
}

/**
 * 원문(제목/본문)에 실제로 등장하는 보존 단어에만 토큰을 배정한다.
 * 긴 단어를 먼저 처리해 "광상갤"이 "광상"보다 먼저 치환되도록 한다.
 */
export function assignTokens(
  terms: PreservedTerm[],
  ...texts: string[]
): ProtectedTerm[] {
  const source = texts.join('\n');
  return [...terms]
    .sort((a, b) => b.term.length - a.term.length)
    .filter((t) => source.includes(t.term))
    .map((t, i) => ({ ...t, token: `${TOKEN_OPEN}T${i + 1}${TOKEN_CLOSE}` }));
}

function replaceAllLiteral(
  text: string,
  search: string,
  replacement: string,
): string {
  return text.split(search).join(replacement);
}

/**
 * 일반 텍스트(제목)의 보존 단어를 토큰으로 치환
 */
export function protectText(
  text: string,
  protectedTerms: ProtectedTerm[],
): string {
  return protectedTerms.reduce(
    (acc, t) => replaceAllLiteral(acc, t.term, t.token),
    text,
  );
}

/**
 * HTML 본문의 보존 단어를 토큰으로 치환. 태그(<img src=...> 등) 안은 건드리지 않고 텍스트 부분만 치환한다.
 */
export function protectHtml(
  html: string,
  protectedTerms: ProtectedTerm[],
): string {
  if (protectedTerms.length === 0) return html;
  return html
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith('<') ? part : protectText(part, protectedTerms),
    )
    .join('');
}

/**
 * 토큰을 원래 단어로 되돌린다
 */
export function restoreTerms(
  text: string,
  protectedTerms: ProtectedTerm[],
): string {
  return protectedTerms.reduce(
    (acc, t) => replaceAllLiteral(acc, t.token, t.term),
    text,
  );
}

/**
 * LLM 응답 검증: 원문에 있던 토큰이 응답에서 사라졌으면(다른 단어로 바뀐 것) 그 토큰 목록을 돌려준다.
 */
export function findMissingTokens(
  output: string,
  protectedTerms: ProtectedTerm[],
): ProtectedTerm[] {
  return protectedTerms.filter((t) => !output.includes(t.token));
}

/**
 * 되돌린 뒤에도 토큰 흔적이 남아 있는지 (LLM이 존재하지 않는 토큰을 만들거나 토큰을 깨뜨린 경우)
 */
export function hasTokenResidue(text: string): boolean {
  TOKEN_PATTERN.lastIndex = 0;
  return (
    TOKEN_PATTERN.test(text) ||
    text.includes(TOKEN_OPEN) ||
    text.includes(TOKEN_CLOSE)
  );
}

/**
 * LLM 프롬프트에 넣을 보존 규칙. 일반 규칙(처음 보는 고유명사·닉네임·줄임말 유지)은 항상 포함하고,
 * 보호 중인 토큰이 있으면 토큰 규칙과 뜻 설명을 덧붙인다.
 */
export function buildPreservationRules(
  protectedTerms: ProtectedTerm[] = [],
): string {
  const rules = [
    '[단어 보존 규칙]',
    '- 사람 이름, 닉네임, 고유명사, 회사·제품·단체명, 줄임말, 갤러리 은어는 철자 그대로 유지하십시오. 비슷한 뜻의 다른 말로 바꾸지 마십시오.',
    '- 처음 보는 단어나 뜻을 모르는 단어를 오타로 판단해 고치지 마십시오. 그대로 두십시오.',
  ];
  if (protectedTerms.length > 0) {
    rules.push(
      `- 본문과 제목의 ${TOKEN_OPEN}T숫자${TOKEN_CLOSE} 형태 표시는 보호된 단어입니다. 기호와 숫자를 한 글자도 바꾸지 말고 그대로 출력하십시오. 원문에 있는 보호된 단어는 결과 본문에서도 빠뜨리지 마십시오. 댓글에서도 같은 표시를 그대로 사용할 수 있습니다.`,
      '- 보호된 단어의 뜻 (문맥 이해용, 이 뜻으로 풀어 쓰지 말고 표시 그대로 사용):',
      ...protectedTerms.map(
        (t) =>
          `  ${t.token}: ${t.meaning ? t.meaning : '뜻 풀이 없음 (문맥으로 판단)'}`,
      ),
    );
  }
  return rules.join('\n');
}
