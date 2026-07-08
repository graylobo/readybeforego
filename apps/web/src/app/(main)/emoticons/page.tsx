'use client';

import { CommonPagination } from '@/components/common/common-pagination';
import { SmartImage } from '@/components/common/smart-image';
import { PageContainer } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmoticonPacks } from '@/hooks/queries/use-emoticon-queries';
import { useDebounce } from '@/hooks/use-debounce';
import { usePaginationLimit } from '@/hooks/use-pagination-limit';
import { useAuthStore } from '@/lib/stores/auth.store';
import { EmoticonPack } from '@community/shared-types';
import { Clock, Plus, Search, ShoppingBag, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EmoticonShopPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'sales' | 'latest'>('sales');
  const [limit, setLimit] = usePaginationLimit('emoticons', 40);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, limit]);

  const { data, isLoading } = useEmoticonPacks({
    q: debouncedSearch || undefined,
    sortBy,
    limit,
    page,
  });

  const packs = data?.items ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <PageContainer maxWidth="shop" className="relative !py-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">이모티콘샵</h1>
            <p className="mt-1 text-violet-200 text-sm">유저가 직접 만든 이모티콘을 구매하고 사용해보세요</p>
          </div>
          <div className="flex flex-col items-center justify-center w-20 h-20 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-2xl">
            <span className="text-4xl">🛍</span>
          </div>
        </PageContainer>
      </div>

      <PageContainer maxWidth="shop">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy('sales')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                sortBy === 'sales'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              판매순
            </button>
            <button
              onClick={() => setSortBy('latest')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                sortBy === 'latest'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              최신순
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="이모티콘 검색..."
                className="pl-9 h-10 rounded-full bg-muted/50 border-border/50"
              />
            </div>
            {user && (
              <>
                <Button
                    variant="outline"
                    onClick={() => router.push('/emoticons/my')}
                    size="sm"
                    className="rounded-full px-4 gap-1.5 border-border hover:bg-muted font-bold whitespace-nowrap"
                >
                    내 이모티콘
                </Button>
                <Button
                    onClick={() => router.push('/emoticons/create')}
                    size="sm"
                    className="rounded-full px-4 gap-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 border-0 shadow-lg shadow-violet-500/30 whitespace-nowrap font-bold"
                >
                    <Plus className="w-4 h-4" />
                    상품 등록
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <span className="text-6xl">🎭</span>
            <p className="text-lg font-medium">이모티콘이 없습니다.</p>
            <p className="text-sm">첫 번째 이모티콘을 등록해보세요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {packs.map((pack) => (
              <EmoticonPackCard key={pack.id} pack={pack} />
            ))}
          </div>
        )}

        {/* Pagination UI */}
        {data && data.total > 0 && (
          <CommonPagination
             currentPage={page}
             totalPages={Math.ceil(data.total / limit)}
             onPageChange={(p) => {
                 setPage(p);
                 window.scrollTo({ top: 0, behavior: 'smooth' });
             }}
             itemsPerPage={limit}
             onItemsPerPageChange={(newLimit) => {
                 setLimit(newLimit);
                 window.scrollTo({ top: 0, behavior: 'smooth' });
             }}
             className="mt-12 pb-8"
          />
        )}
      </PageContainer>
    </div>
  );
}

function EmoticonPackCard({ pack }: { pack: EmoticonPack }) {
  return (
    <Link
      href={`/emoticons/${pack.id}`}
      className="group relative bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        <SmartImage
          src={pack.thumbnailUrl || ''}
          alt={pack.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 left-2">
          <Badge className="text-[10px] font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 shadow-md">
            판매중
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-bold text-sm truncate text-foreground">{pack.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          제작: {(pack.author as any)?.name ?? '알 수 없음'}
        </p>

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-extrabold text-primary">
            {pack.price === 0 ? '무료' : `${pack.price.toLocaleString()}P`}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShoppingBag className="w-3 h-3" />
            <span>판매 {pack.salesCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
