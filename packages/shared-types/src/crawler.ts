export interface PreservedTerm {
  term: string;
  // 맥락 설명 (예: 광상 = 광우상사). LLM이 문장을 자연스럽게 만들 수 있도록 함께 전달
  meaning?: string;
}

/**
 * 보존 단어 문자열 파싱. 쉼표 또는 줄바꿈으로 구분하고, "단어=뜻" 형식으로 뜻을 붙일 수 있다.
 * 예: "광상=광우상사, 잉여햄\n광붕이"
 * API(수집)와 관리자 화면(미리보기)이 같은 규칙으로 해석하도록 공유한다.
 */
export function parsePreservedTerms(raw?: string | null): PreservedTerm[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const terms: PreservedTerm[] = [];
  for (const entry of raw.split(/[,\n]/)) {
    const [termPart, ...meaningParts] = entry.split('=');
    const term = termPart.trim();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    const meaning = meaningParts.join('=').trim();
    terms.push(meaning ? { term, meaning } : { term });
  }
  return terms;
}

/**
 * 제외 키워드 문자열 파싱. 쉼표 또는 줄바꿈으로 구분한다 (예: "광고, 홍보\n코인").
 * API(수집)와 관리자 화면(미리보기)이 같은 규칙으로 해석하도록 공유한다.
 */
export function parseExcludeKeywords(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const entry of raw.split(/[,\n]/)) {
    const keyword = entry.trim();
    const key = normalizeForKeywordMatch(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords;
}

// 대소문자와 띄어쓰기를 무시하고 비교한다 ("광 고", "AD"도 "광고", "ad"에 걸리게)
function normalizeForKeywordMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/** 글(제목·본문)에 들어 있는 첫 제외 키워드. 없으면 null */
export function findExcludeKeyword(keywords: string[], ...texts: string[]): string | null {
  if (keywords.length === 0) return null;
  const sources = texts.map(normalizeForKeywordMatch);
  return keywords.find((k) => sources.some((s) => s.includes(normalizeForKeywordMatch(k)))) ?? null;
}
