import { getPageEntries, getPostEntries, SITEMAP_HEADERS, sitemapUnavailable, urlsetXml } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

/** 사이트맵 조각: pages.xml(고정 페이지·게시판) 또는 posts-N.xml(사람이 쓴 글 N번째 5만 개) */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const postsMatch = file.match(/^posts-(\d+)\.xml$/);
  if (file !== 'pages.xml' && !postsMatch) return new Response('Not Found', { status: 404 });
  try {
    const entries = postsMatch ? await getPostEntries(Number(postsMatch[1])) : await getPageEntries();
    if (postsMatch && entries.length === 0) return new Response('Not Found', { status: 404 });
    return new Response(urlsetXml(entries), { headers: SITEMAP_HEADERS });
  } catch {
    return sitemapUnavailable();
  }
}
