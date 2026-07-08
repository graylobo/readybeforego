'use client';

import { PostList } from '@/components/board/post-list';
import { RecentBoards } from '@/components/board/recent-boards';
import { FeedPostWriteModal } from '@/components/board/feed-post-write-modal';
import { CommonPagination } from '@/components/common/common-pagination';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { DelayedRender } from '@/components/ui/delayed-render';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    useBoard,
    usePosts
} from '@/hooks/queries/use-board-queries';
import { usePaginationLimit } from '@/hooks/use-pagination-limit';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRecentBoardsStore } from '@/lib/stores/recent-boards.store';
import {
    ChevronDown,
    PenSquare,
    Search,
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function BoardPage({ params }: { params: { slug: string } }) {
    const paramsHook = useParams(); 
    const slug = paramsHook?.slug as string || params.slug; 

    return <BoardContent slug={slug} />;
}

function BoardContent({ slug }: { slug: string }) {
    const { user } = useAuthStore();
    const router = useRouter();
    const { addBoard } = useRecentBoardsStore();

    const searchParams = useSearchParams();
    const urlSearchQuery = searchParams?.get('searchQuery') || '';
    const urlSearchType = searchParams?.get('searchType') || 'titleContent';

    // States for pagination and search
    const [page, setPage] = useState(1);
    const [limit, setLimit] = usePaginationLimit('board-posts', 30); 
    const [searchType, setSearchType] = useState(urlSearchType);
    const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
    const [activeSearch, setActiveSearch] = useState({ type: urlSearchType, query: urlSearchQuery });
    const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

    // URL의 파라미터가 외부(레이아웃 검색바 등)에서 변경되었을 때 상태를 동기화
    useEffect(() => {
        setSearchQuery(urlSearchQuery);
        setSearchType(urlSearchType);
        setActiveSearch({ type: urlSearchType, query: urlSearchQuery });
        setPage(1);
    }, [urlSearchQuery, urlSearchType]);

    const { data: board, isLoading: boardLoading } = useBoard(slug);
    const isSpecialBest = slug === 'best';
    const isSearching = !!activeSearch.query;
    const showBlocks = !isSpecialBest && !isSearching && page === 1;

    const { 
        data: postsData, 
        isLoading: postsLoading 
    } = usePosts(
        slug, 
        page, 
        limit, 
        activeSearch.type, 
        activeSearch.query,
        undefined,
        undefined,
        showBlocks ? 'false' : undefined // if showing blocks, exclude notice from normal feed
    );

    const { data: noticeData, isLoading: noticeLoading } = usePosts(
        slug, 1, 5, undefined, undefined, undefined, undefined, 'true', { enabled: showBlocks }
    );
    const { data: bestData, isLoading: bestLoading } = usePosts(
        slug, 1, 10, undefined, undefined, undefined, 'true', 'false', { enabled: showBlocks }
    );

    const mainPosts = postsData?.items || [];
    const noticePosts = noticeData?.items || [];
    const bestPosts = bestData?.items || [];

    const combinedPosts = [];
    if (showBlocks) {
        combinedPosts.push(...noticePosts);
        
        const bestPostsWithFlag = bestPosts.map(p => ({ ...p, _isBestBlock: true }));
        combinedPosts.push(...bestPostsWithFlag);
    }
    
    combinedPosts.push(...mainPosts);

    const totalCount = postsData?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    useEffect(() => {
        if (board?.name && slug) {
            addBoard({ slug, name: board.name });
        }
    }, [board?.name, slug, addBoard]);

    const isLoading = boardLoading || postsLoading || (showBlocks && (noticeLoading || bestLoading));

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            alert('검색어를 입력해주세요');
            return;
        }
        router.push(`/board/${slug}?searchQuery=${encodeURIComponent(searchQuery)}&searchType=${searchType}`);
    };

    if (isLoading && !postsData) {
        return (
            <DelayedRender>
                <PageContainer className="py-8">
                    <div className="w-full">
                        <main className="flex-1 min-w-0">
                            <div className="space-y-4">
                                <Skeleton className="h-10 w-1/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <div className="mt-8 space-y-3">
                                    {[...Array(10)].map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full" />
                                    ))}
                                </div>
                            </div>
                        </main>
                    </div>
                </PageContainer>
            </DelayedRender>
        );
    }

    if (!board) return <PageContainer className="py-8">Board not found</PageContainer>;

    return (
        <PageContainer className="py-8" maxWidth={(board.viewMode === 'feed' || board.viewMode === 'lounge') ? 'feed' : 'default'}>
            <div className="w-full">
                <main className="flex-1 min-w-0">
                    <RecentBoards />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{board.name}</h1>
                            <p className="text-muted-foreground">{board.description}</p>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="inline-block">
                                        <Button 
                                            disabled={!user && !board.allowAnonymous}
                                            onClick={() => {
                                                if (board.viewMode === 'feed' || board.viewMode === 'lounge') {
                                                    setIsWriteModalOpen(true);
                                                } else {
                                                    router.push(`/board/${slug}/write`);
                                                }
                                            }}
                                        >
                                            <PenSquare className="w-4 h-4 mr-2" />
                                            글쓰기
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                {!user && !board.allowAnonymous && (
                                    <TooltipContent>
                                        <p>로그인후 글을 작성할 수 있습니다.</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <PostList 
                        posts={combinedPosts} 
                        slug={slug} 
                        highlightQuery={activeSearch.query}
                        viewMode={board.viewMode}
                    />

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="mt-8">
                            <CommonPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                              
                            />
                        </div>
                    )}

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="mt-8 flex justify-center items-center gap-1.5 h-10">
                        <div className="relative w-full max-w-xs h-full">
                            <Input 
                                placeholder="검색어를 입력하세요..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10 h-full"
                            />
                            <Button 
                                type="submit" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-0 top-0 h-full"
                            >
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2 px-3 h-full min-w-[100px] justify-between font-normal">
                                    <span>
                                        {searchType === 'titleContent' && '제목 + 내용'}
                                        {searchType === 'title' && '제목'}
                                        {searchType === 'content' && '내용'}
                                        {searchType === 'nickname' && '닉네임'}
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[100px]">
                                <DropdownMenuItem onClick={() => setSearchType('titleContent')}>제목 + 내용</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSearchType('title')}>제목</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSearchType('content')}>내용</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSearchType('nickname')}>닉네임</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </form>

                    {/* Write Modal for Feed mode */}
                    <FeedPostWriteModal 
                        isOpen={isWriteModalOpen}
                        onOpenChange={setIsWriteModalOpen}
                        boardSlug={slug}
                        boardName={board.name}
                    />
                </main>
            </div>
        </PageContainer>
    );
}
