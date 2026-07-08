import { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/constants';
import { boardApi } from '@/lib/api/board';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_CONFIG.url;

  try {
    // 1. 정적 페이지 목록
    const routes = ['', '/points', '/events', '/search', '/auth/login', '/auth/register'].map(
      (route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: route === '' ? 1 : 0.8,
      })
    );

    // 2. 게시판 목록 (Board Slugs)
    const boards = await boardApi.getBoards();
    const boardRoutes = boards.map((board) => ({
      url: `${baseUrl}/board/${board.slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }));

    // 3. 최신 게시글 목록 (Top 100 posts)
    const { items: posts } = await boardApi.getPosts(undefined, 1, 100);
    const postRoutes = posts.map((post) => ({
      url: `${baseUrl}/board/${post.board?.slug || 'all'}/${post.id}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...routes, ...boardRoutes, ...postRoutes];
  } catch (error) {
    console.error('Failed to generate dynamic sitemap:', error);
    // 에러 시 최소한의 정적 경로라도 반환
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      },
    ];
  }
}
