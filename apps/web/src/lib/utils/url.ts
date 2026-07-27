/**
 * 외부 링크 URL 정제 유틸리티
 * - 프로토콜(http:// 또는 https://)이 누락되었거나 오탈자(https:/ 등)가 있는 경우 
 *   자사 도메인이 상대 경로로 붙는 버그를 방지하고 올바른 절대 URL로 정제합니다.
 */
export function formatExternalUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed) return '';

  // 오탈자 프로토콜 정제 (e.g. "https:/th.usembassy.gov" -> "https://th.usembassy.gov")
  trimmed = trimmed.replace(/^(https?):?\/?(?!\/)/i, '$1://');

  // 프로토콜(http:// 또는 https://)이 전혀 없을 경우 기본적으로 https:// 추가
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  return trimmed;
}
