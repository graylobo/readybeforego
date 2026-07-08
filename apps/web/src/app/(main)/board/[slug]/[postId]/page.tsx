import { Metadata } from 'next';
import { boardApi } from '@/lib/api/board';
import { PostDetailClient } from './post-detail-client';
import { SITE_CONFIG } from '@/lib/constants';

interface Props {
  params: Promise<{ slug: string; postId: string }>;
}

/**
 * Dynamic SEO를 위한 메타데이터 생성 함수
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postId } = await params;
  
  try {
    const post = await boardApi.getPost(postId, false);
    const board = await boardApi.getBoard(slug);

    // 본문 내용에서 HTML 태그를 제거하여 요약문 생성
    const cleanContent = post.content.replace(/<[^>]*>?/gm, '').substring(0, 160);

    // 본문에서 첫 번째 썸네일 이미지 추출
    const imgMatch = post.content.match(/<img[^>]+src="([^">]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    return {
      title: post.title,
      description: cleanContent || `${board.name} 게시판의 게시글입니다.`,
      openGraph: {
        title: post.title,
        description: cleanContent,
        type: 'article',
        url: `${SITE_CONFIG.url}/board/${slug}/${postId}`,
        authors: [post.user?.name || post.guestName || '익명'],
        publishedTime: post.createdAt,
        ...(imageUrl && { images: [imageUrl] }),
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description: cleanContent,
      },
    };
  } catch (error) {
    return {
      title: '게시글을 찾을 수 없습니다',
    };
  }
}

/**
 * 서버 컴포넌트 페이지
 */
export default async function PostDetailPage({ params }: Props) {
  const { slug, postId } = await params;
  
  // 초기 데이터를 서버에서 fetch (Hydration 및 초기 렌더링 최적화)
  let initialPost;
  try {
    initialPost = await boardApi.getPost(postId, false);
  } catch (e) {
    initialPost = undefined;
  }

  return (
    <PostDetailClient 
      slug={slug} 
      postId={postId} 
      initialPost={initialPost} 
    />
  );
}
