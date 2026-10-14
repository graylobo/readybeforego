import { getSitemapPaths, SITEMAP_HEADERS, sitemapIndexXml, sitemapUnavailable } from '@/lib/sitemap';

// 요청 때 만들고 Vercel이 1시간 저장 (배포 때 한 번만 만들면 새 글이 다음 배포까지 빠졌다)
export const dynamic = 'force-dynamic';

/** 사이트맵 목차: 고정 페이지 조각 + 글 수에 맞게 늘어나는 글 조각들 */
export async function GET() {
  try {
    return new Response(sitemapIndexXml(await getSitemapPaths()), { headers: SITEMAP_HEADERS });
  } catch {
    return sitemapUnavailable();
  }
}
