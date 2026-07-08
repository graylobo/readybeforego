'use client';

import { PostList } from '@/components/board/post-list';
import { CommonPagination } from '@/components/common/common-pagination';
import { PageContainer } from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { usePosts } from '@/hooks/queries/use-board-queries';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'titleContent';
  const authorId = searchParams.get('authorId') || undefined;
  const authorName = searchParams.get('authorName') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  
  const { data, isLoading } = usePosts(undefined, page, limit, type, query, authorId);
  
  const posts = data?.items || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);
  
  const title = authorId 
    ? `${authorName || '사용자'}의 게시글`
    : `"${query}" 검색 결과`;

  const emptyMessage = authorId
    ? "아직 작성한 게시글이 없습니다."
    : `"${query}"에 대한 검색 결과가 없습니다.`;

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/search?${params.toString()}`);
  };

  return (
    <PageContainer maxWidth="lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1">
          총 {totalCount}개의 게시글을 찾았습니다.
        </p>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="bg-card border shadow-sm">
            <PostList 
              posts={posts} 
              emptyMessage={emptyMessage} 
              highlightQuery={authorId ? undefined : query}
            />
          </div>

          {totalPages > 1 && (
            <div className="mt-8">
              <CommonPagination
                 currentPage={page}
                 totalPages={totalPages}
                 onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<PageContainer maxWidth="lg"><Skeleton className="h-10 w-48 mb-6" /><Skeleton className="h-64 w-full" /></PageContainer>}>
      <SearchResults />
    </Suspense>
  );
}
