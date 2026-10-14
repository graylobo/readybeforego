import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { boardApi, BoardPageParams } from '@/lib/api/board';
import { getServerRequestConfig, isServerViewForVisitor } from '@/lib/api/server-request-config';
import { BoardPageClient, DEFAULT_BOARD_POST_LIMIT } from './board-page-client';
import { parsePageParam } from '@/lib/utils/list-url';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[]; searchQuery?: string | string[]; searchType?: string | string[] }>;
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

async function getInitialParams(searchParams: Props['searchParams']): Promise<BoardPageParams> {
  const sp = await searchParams;
  const searchQuery = firstValue(sp.searchQuery).trim();
  return {
    page: parsePageParam(firstValue(sp.page)),
    limit: DEFAULT_BOARD_POST_LIMIT,
    searchType: searchQuery ? firstValue(sp.searchType) || 'titleContent' : undefined,
    searchQuery: searchQuery || undefined,
  };
}

// generateMetadata와 페이지가 같은 데이터를 한 번만 요청하도록 공유 (axios라 Next의 fetch 중복 제거가 적용되지 않음)
const getBoardPage = cache(async (slug: string, paramsKey: string) =>
  boardApi.getBoardPage(slug, JSON.parse(paramsKey), await getServerRequestConfig()),
);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const initialParams = await getInitialParams(searchParams);
  try {
    const { board } = await getBoardPage(slug, JSON.stringify(initialParams));
    return {
      title: board.name,
      description: board.description || `${board.name} 게시판`,
    };
  } catch {
    return { title: '게시판을 찾을 수 없습니다' };
  }
}

/**
 * 게시판 첫 화면을 서버에서 렌더링해, 브라우저가 JS를 받은 뒤 API를 다시 부를 때까지 기다리지 않게 한다
 */
export default async function BoardPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const initialParams = await getInitialParams(searchParams);
  const [data, isForVisitor] = await Promise.all([
    getBoardPage(slug, JSON.stringify(initialParams)).catch((error) => {
      // 없는 게시판은 404 페이지로. 그 밖의 오류는 브라우저에서 다시 시도하도록 빈 상태로 넘긴다
      if (error?.response?.status === 404) notFound();
      return undefined;
    }),
    isServerViewForVisitor(),
  ]);

  return (
    <BoardPageClient
      key={slug}
      slug={slug}
      initial={data ? { params: initialParams, data, isForVisitor } : undefined}
    />
  );
}
