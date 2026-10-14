// 본문에 이미지(HTML img 태그 또는 마크다운 이미지)가 있는지 여부
// scripts/db-backfill-counts.js의 has_image 재계산 SQL과 같은 규칙
export function contentHasImage(content: string | null | undefined): boolean {
  return /<img[^>]+src=[^>]+>|!\[[^\]]*\]\([^)]+\)/i.test(content || '');
}
