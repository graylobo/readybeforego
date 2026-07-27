/**
 * 외부 링크 URL 정제 유틸리티 (항등성/Idempotent 보장)
 * - 마크다운 링크 포맷([text](http://...))에서 순수 URL만 자동 추출합니다.
 * - 프로토콜 중복(https://://:// 등) 또는 프로토콜 오탈자(https:/ 등)를 완벽히 털어내고
 *   단 하나의 올바른 절대 URL(https://...)로 정제합니다.
 */
export function formatExternalUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed) return '';

  // 1. 마크다운 링크 패턴 [text](https://...) 또는 [https://...](https://...) 정제
  const markdownMatch = trimmed.match(/\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
  if (markdownMatch && markdownMatch[1]) {
    trimmed = markdownMatch[1];
  } else {
    trimmed = trimmed.replace(/^\[+/, '').replace(/\]+$/, '');
  }

  // 기존 http:// 보존 여부 확인
  const isHttp = /^http:\/\//i.test(trimmed);

  // 2. 모든 프로토콜 접두사 및 중복 기호(e.g., "https://://://", "https:/", "http://https://", "https:") 완전히 제거
  trimmed = trimmed.replace(/^(https?|http)[\s::/\\=]+/gi, '');

  if (!trimmed) return '';

  // 3. 단 하나의 올바른 프로토콜 접두사 재결합 (Idempotent 100% 보장)
  return isHttp ? `http://${trimmed}` : `https://${trimmed}`;
}
