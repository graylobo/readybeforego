'use client';

import { PostList } from '@/components/board/post-list';
import { RecentBoards } from '@/components/board/recent-boards';
import { FeedPostWriteModal } from '@/components/board/feed-post-write-modal';
import { CommonPagination } from '@/components/common/common-pagination';
import { PageContainer } from '@/components/layout/page-container';
import { scrollMainToTop } from '@/components/layout/main-scroll-restoration';
import { parsePageParam, pushSearchParams } from '@/lib/utils/list-url';
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
import { useBoardPage } from '@/hooks/queries/use-board-queries';
import { useBoardPermissions } from '@/hooks/queries/use-board-community-queries';
import { UserProfilePopover } from '@/components/common/user-profile-popover';
import Link from 'next/link';
import type { BoardPageData, BoardPageParams } from '@/lib/api/board';
import { usePaginationLimit } from '@/hooks/use-pagination-limit';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRecentBoardsStore } from '@/lib/stores/recent-boards.store';
import {
    ChevronDown,
    Lock,
    PenSquare,
    Search,
    Settings,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export const DEFAULT_BOARD_POST_LIMIT = 30;

interface BoardPageClientProps {
    slug: string;
    // 서버 렌더링으로 받은 첫 화면 데이터 (비로그인 기준)
    initial?: { params: BoardPageParams; data: BoardPageData; isForVisitor: boolean };
}

export function BoardPageClient({ slug, initial }: BoardPageClientProps) {
    const { user } = useAuthStore();
    const router = useRouter();
    const { addBoard } = useRecentBoardsStore();

    const searchParams = useSearchParams();
    const urlSearchQuery = searchParams?.get('searchQuery') || '';
    const urlSearchType = searchParams?.get('searchType') || 'titleContent';

    // 페이지 번호는 주소(?page=)에 둔다: 글을 보다가 뒤로가기 하면 보던 페이지로 돌아오도록
    const page = parsePageParam(searchParams?.get('page'));
    const [limit] = usePaginationLimit('board-posts', DEFAULT_BOARD_POST_LIMIT);
    const [searchType, setSearchType] = useState(urlSearchType);
    const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
    const [activeSearch, setActiveSearch] = useState({ type: urlSearchType, query: urlSearchQuery });
    const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

    // URL의 파라미터가 외부(레이아웃 검색바 등)에서 변경되었을 때 상태를 동기화
    useEffect(() => {
        setSearchQuery(urlSearchQuery);
        setSearchType(urlSearchType);
        setActiveSearch({ type: urlSearchType, query: urlSearchQuery });
    }, [urlSearchQuery, urlSearchType]);

    const handlePageChange = (nextPage: number) => {
        pushSearchParams({ page: nextPage > 1 ? String(nextPage) : null });
        // 페이지를 바꾸면 새 목록의 맨 위부터
        scrollMainToTop();
    };

    const isSearching = !!activeSearch.query;
    // 게시판 정보, 공지/인기글(첫 페이지), 목록을 한 번의 요청으로 받는다
    const { data: pageData, isLoading } = useBoardPage(
        slug,
        {
            page,
            limit,
            searchType: isSearching ? activeSearch.type : undefined,
            searchQuery: isSearching ? activeSearch.query : undefined,
        },
        user?.id,
        initial,
    );
    const board = pageData?.board;
    // 전체/베스트는 여러 게시판 글을 모아 보여주기만 하는 화면이라 글쓰기·관리자가 없다
    const isVirtualBoard = slug === 'all' || slug === 'best';
    const { managers, canManage } = useBoardPermissions(isVirtualBoard ? '' : slug);
    const manager = managers.find((m) => m.role === 'manager');
    const subManagers = managers.filter((m) => m.role === 'sub_manager');

    const combinedPosts = [
        ...(pageData?.notices ?? []),
        ...(pageData?.best ?? []).map(p => ({ ...p, _isBestBlock: true })),
        ...(pageData?.posts.items ?? []),
    ];

    const totalCount = pageData?.posts.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    useEffect(() => {
        if (board?.name && slug) {
            addBoard({ slug, name: board.name });
        }
    }, [board?.name, slug, addBoard]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            alert('검색어를 입력해주세요');
            return;
        }
        router.push(`/board/${slug}?searchQuery=${encodeURIComponent(searchQuery)}&searchType=${searchType}`);
    };

    if (isLoading && !pageData) {
        return (
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
        );
    }

    if (!board) return <PageContainer className="py-8">존재하지 않는 게시판입니다.</PageContainer>;

    return (
        <PageContainer className="py-8" maxWidth={(board.viewMode === 'feed' || board.viewMode === 'lounge') ? 'feed' : 'default'}>
            <div className="w-full">
                <main className="flex-1 min-w-0">
                    <RecentBoards current={board?.name ? { slug, name: board.name } : undefined} />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{board.name}</h1>
                            <p className="text-muted-foreground">{board.description}</p>
                            {/* 매니저가 '관리자 표시'를 끄면 숨긴다 (매니저 본인에게도 화면은 같게) */}
                            {manager && board.showManagers !== false && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    매니저{' '}
                                    <UserProfilePopover userId={manager.userId} userName={manager.name} userPicture={manager.picture} className="font-semibold text-foreground hover:text-primary cursor-pointer">
                                        {manager.name}
                                    </UserProfilePopover>
                                    {subManagers.length > 0 && (
                                        <>
                                            {' · 부매니저 '}
                                            {subManagers.map((m, i) => (
                                                <span key={m.userId}>
                                                    {i > 0 && ', '}
                                                    <UserProfilePopover userId={m.userId} userName={m.name} userPicture={m.picture} className="hover:text-primary cursor-pointer">
                                                        {m.name}
                                                    </UserProfilePopover>
                                                </span>
                                            ))}
                                        </>
                                    )}
                                </p>
                            )}
                            {board.isReadOnly && !isVirtualBoard && (
                                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                    <Lock className="h-3 w-3" /> 읽기 전용 게시판입니다. 새 글과 댓글을 쓸 수 없습니다.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                        {canManage && !isVirtualBoard && (
                            <Button variant="outline" asChild>
                                <Link href={`/board/${slug}/manage`}>
                                    <Settings className="w-4 h-4 mr-2" />
                                    게시판 관리
                                </Link>
                            </Button>
                        )}
                        {!isVirtualBoard && !board.isReadOnly && (
                       <Button 
                            onClick={() => {
                                // 비로그인 유저이고 익명 작성이 금지된 게시판인 경우 🔒
                                if (!user && !board.allowAnonymous) {
                                    const confirmLogin = confirm(
                                        "로그인 해야만 작성이 가능한 게시판 입니다. 로그인페이지로 이동하시겠습니까?"
                                    );
                                    if (confirmLogin) {
                                        const currentPath = window.location.pathname + window.location.search;
                                        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
                                    }
                                    return;
                                }

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
                        )}
                        </div>
                    </div>

                    <PostList 
                        posts={combinedPosts} 
                        // 전체/베스트는 여러 게시판 글이라 게시판 주소를 넘기지 않는다: 제목 앞에 게시판 이름이 붙고 링크는 글의 실제 게시판으로
                        slug={isVirtualBoard ? undefined : slug} 
                        highlightQuery={activeSearch.query}
                        viewMode={board.viewMode}
                    />

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="mt-8">
                            <CommonPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                              
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
