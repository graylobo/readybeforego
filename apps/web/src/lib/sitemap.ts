import { boardApi } from '@/lib/api/board';
import { SITE_CONFIG } from '@/lib/constants';

/**
 * 사이트맵: /sitemap.xml(목차) → /sitemap/pages.xml(고정 페이지·게시판) + /sitemap/posts-N.xml(사람이 쓴 글, 조각당 최대 5만 개).
 * 요청 때 API로 조회해 만들고, Vercel이 1시간 동안 저장해 둔 것을 보낸다 (그 사이에는 API·DB를 다시 부르지 않음).
 * 크롤러가 가져온 글은 넣지 않는다 (글 화면에도 noindex)
 */
export const SITEMAP_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
};

/** API를 못 불렀을 때: 빈 사이트맵이 저장되지 않도록 저장하지 말라고 하고 503 */
export function sitemapUnavailable() {
  return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '600' } });
}

export interface SitemapEntry {
  url: string;
  /** 실제로 바뀐 시각을 아는 것만 (모르는 것에 지금 시각을 넣으면 검색엔진이 사이트맵을 덜 믿는다) */
  lastModified?: string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function urlsetXml(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const parts = [`<loc>${escapeXml(entry.url)}</loc>`];
    if (entry.lastModified) parts.push(`<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`);
    if (entry.changeFrequency) parts.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
    if (entry.priority !== undefined) parts.push(`<priority>${entry.priority}</priority>`);
    return `<url>${parts.join('')}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

export function sitemapIndexXml(paths: string[]): string {
  const items = paths.map((path) => `<sitemap><loc>${escapeXml(`${SITE_CONFIG.url}${path}`)}</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>`;
}

/** 목차에 넣을 조각 주소: 고정 페이지 1개 + 글 수에 맞는 글 조각 */
export async function getSitemapPaths(): Promise<string[]> {
  const { total, chunkSize } = await boardApi.getSitemapSummary();
  const postChunks = Math.ceil(total / chunkSize);
  return ['/sitemap/pages.xml', ...Array.from({ length: postChunks }, (_, i) => `/sitemap/posts-${i}.xml`)];
}

/** 고정 페이지와 게시판 (실제로 있는 공개 페이지만. 로그인 화면 등은 넣지 않음) */
export async function getPageEntries(): Promise<SitemapEntry[]> {
  const baseUrl = SITE_CONFIG.url;
  const staticPages: SitemapEntry[] = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/board/all`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${baseUrl}/boards`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/points`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${baseUrl}/search`, changeFrequency: 'weekly', priority: 0.5 },
  ];
  const boards = await boardApi.getBoards();
  const boardPages = boards
    .filter((board) => !board.isPrivate)
    .map((board): SitemapEntry => ({ url: `${baseUrl}/board/${board.slug}`, changeFrequency: 'hourly', priority: 0.9 }));
  return [...staticPages, ...boardPages];
}

export async function getPostEntries(chunk: number): Promise<SitemapEntry[]> {
  const posts = await boardApi.getSitemapChunk(chunk);
  return posts.map((post) => ({
    url: `${SITE_CONFIG.url}/board/${post.boardSlug}/${post.id}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
}
