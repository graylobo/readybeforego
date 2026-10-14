import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { boardApi } from '@/lib/api/board';
import { commentsApi, COMMENT_PAGE_LIMIT } from '@/lib/api/comments';
import { PostDetailClient } from './post-detail-client';
import { SITE_CONFIG } from '@/lib/constants';
import { getServerRequestConfig, isServerViewForVisitor } from '@/lib/api/server-request-config';
import { ErrorCode } from '@community/shared-types';

// 한 요청 안에서 generateMetadata와 페이지가 같은 게시글/게시판을 각각 요청하지 않도록 결과를 공유한다
// (apiClient는 axios라 Next의 fetch 요청 중복 제거가 적용되지 않음)
const getPost = cache(async (postId: string) => boardApi.getPost(postId, await getServerRequestConfig()));

/**
 * 게시글 응답에 들어 있는 게시판을 쓰고, 주소의 게시판이 다를 때(베스트 게시판에서 연 글 등)나
 * 게시글을 서버에서 못 받았을 때(비공개 글)만 게시판을 따로 요청한다
 */
const getBoard = cache(async (slug: string, postId: string) => {
  const post = await getPost(postId).catch(() => undefined);
  if (post?.board?.slug === slug) return post.board;
  return boardApi.getBoard(slug, await getServerRequestConfig());
});

function isNotFound(error: any) {
  return error?.response?.status === 404;
}

/**
 * 비공개 처리한 글: 서버 렌더링은 로그인 정보 없이 요청해(쿠키는 API 도메인에 있음) Super Admin도 404를 받는다.
 * 바로 404 화면을 내지 않고 브라우저에서 로그인 정보로 다시 받게 한다 (Super Admin이 아니면 거기서도 "찾을 수 없음")
 */
function isHiddenPost(error: any) {
  return error?.response?.data?.errorCode === ErrorCode.POST_HIDDEN;
}

interface Props {
  params: Promise<{ slug: string; postId: string }>;
}

/**
 * Dynamic SEO를 위한 메타데이터 생성 함수
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postId } = await params;
  
  try {
    const [post, board] = await Promise.all([getPost(postId), getBoard(slug, postId)]);

    // 본문 내용에서 HTML 태그를 제거하여 요약문 생성
    const cleanContent = (post.content ?? '').replace(/<[^>]*>?/gm, '').substring(0, 160);

    // 본문에서 첫 번째 썸네일 이미지 추출
    const imgMatch = (post.content ?? '').match(/<img[^>]+src="([^">]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    return {
      title: post.title,
      description: cleanContent || `${board.name} 게시판의 게시글입니다.`,
      // 크롤러가 가져온 글은 검색 결과에 넣지 않되, 글 안의 링크(다른 글·게시판)는 따라가게 한다
      ...(post.noIndex && { robots: { index: false, follow: true } }),
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
      // 비공개 처리한 글 등 서버에서 못 받은 글은 검색 결과에서 빠지게 한다
      robots: { index: false, follow: false },
    };
  }
}

/**
 * 서버 컴포넌트 페이지
 */
export default async function PostDetailPage({ params }: Props) {
  const { slug, postId } = await params;
  
  // 게시글(게시판 포함)과 댓글 첫 페이지를 서버에서 동시에 받아 함께 그린다 (브라우저에서 다시 요청하지 않게)
  // 비공개 글처럼 서버에서 볼 수 없는 경우(401/403)는 브라우저에서 로그인 정보로 다시 시도한다
  const [initialPost, initialBoard, initialComments, isForVisitor] = await Promise.all([
    getPost(postId).catch((error) => {
      if (isNotFound(error) && !isHiddenPost(error)) notFound();
      return undefined;
    }),
    getBoard(slug, postId).catch(() => undefined),
    commentsApi
      .getComments('post', postId, 1, COMMENT_PAGE_LIMIT, await getServerRequestConfig())
      .catch(() => undefined),
    isServerViewForVisitor(),
  ]);

  // 다른 게시판 주소로 들어왔으면(예: /board/all/글번호, 옛 링크) 글이 실제로 있는 게시판 주소로 보낸다
  const realSlug = initialPost?.board?.slug;
  if (realSlug && realSlug !== slug) permanentRedirect(`/board/${realSlug}/${postId}`);

  return (
    <PostDetailClient 
      slug={slug} 
      postId={postId} 
      initialPost={initialPost} 
      initialBoard={initialBoard}
      initialComments={initialPost?.allowComments === false ? undefined : initialComments}
      initialIsForVisitor={isForVisitor}
    />
  );
}
