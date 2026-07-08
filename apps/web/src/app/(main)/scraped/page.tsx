'use client';

import { PostList } from '@/components/board/post-list';
import { CommonPagination } from '@/components/common/common-pagination';
import { PageContainer } from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyScrappedPosts } from '@/hooks/queries/use-board-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { Bookmark } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function ScrapedPostsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login?redirect=/scraped');
    }
  }, [user, isLoading, router]);

  const { data, isLoading: isDataLoading } = useMyScrappedPosts(page, limit);

  const posts = data?.items.map(item => ({
    ...item.post,
    user: item.user,
    board: item.board
  })) || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/scraped?${params.toString()}`);
  };

  if (!user && !isLoading) return null;

  return (
    <PageContainer maxWidth="lg" className="py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Bookmark className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">스크랩한 게시글</h1>
          <p className="text-muted-foreground mt-1">
            보관한 게시글: {totalCount}개
          </p>
        </div>
      </div>
      
      {isDataLoading ? (
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
              emptyMessage="아직 스크랩한 게시글이 없습니다."
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

export default function ScrapedPostsPage() {
  return (
    <Suspense fallback={
      <PageContainer maxWidth="lg" className="py-8">
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </PageContainer>
    }>
      <ScrapedPostsContent />
    </Suspense>
  );
}

