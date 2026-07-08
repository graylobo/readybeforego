'use client';

import { CommonPagination } from '@/components/common/common-pagination';
import { PageContainer } from '@/components/layout/page-container';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePosts } from '@/hooks/queries/use-board-queries';
import { useUserComments } from '@/hooks/queries/use-comment-queries';
import { usePublicProfile } from '@/hooks/queries/use-profile-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Search as SearchIcon
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const page = parseInt(searchParams.get('page') || '1');
  const searchQuery = searchParams.get('q') || '';
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');
  const limit = 20;

  const { data: profile, isLoading: isProfileLoading } = usePublicProfile(id);
  
  const { data: postsData, isLoading: isPostsLoading } = usePosts(
    undefined, 
    page, 
    limit, 
    'titleContent', 
    searchQuery, 
    id
  );

  const { data: commentsData, isLoading: isCommentsLoading } = useUserComments(
    id,
    page,
    limit
  );

  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/users/${id}?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (localSearch) {
      params.set('q', localSearch);
    } else {
      params.delete('q');
    }
    params.set('page', '1');
    router.push(`/users/${id}?${params.toString()}`);
  };

  if (isProfileLoading) {
    return (
      <PageContainer maxWidth="lg" className="py-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start bg-card p-8 rounded-3xl border shadow-sm">
          <Skeleton className="h-40 w-40 rounded-full" />
          <div className="flex-1 space-y-4 w-full">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer maxWidth="lg" className="py-20 text-center">
        <h1 className="text-2xl font-bold">사용자를 찾을 수 없습니다.</h1>
        <Button onClick={() => router.back()} className="mt-4">뒤로 가기</Button>
      </PageContainer>
    );
  }

  const posts = postsData?.items || [];
  const currentTotal = activeTab === 'posts' 
    ? (postsData?.total || 0) 
    : (commentsData?.total || 0);
  const totalPages = Math.ceil(currentTotal / limit);

  return (
    <PageContainer maxWidth="lg" className="py-8 space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start bg-card p-10 relative overflow-hidden border-b border-border/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/2 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        
        <Avatar className="h-40 w-40 border-4 border-background shadow-2xl ring-1 ring-border/30">
          {profile.picture && <AvatarImage src={profile.picture} alt={profile.name} />}
          <AvatarFallback className="text-5xl font-black bg-muted text-muted-foreground/50">
            {profile.name.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 flex flex-col justify-center py-2">
          <div className="space-y-2.5">
            <div className="inline-flex items-center h-12 px-6 gap-3 rounded-full bg-muted/40 border border-border/40 shadow-sm w-fit">
              <span className="text-[13px] font-bold text-muted-foreground/60">닉네임</span>
              <span className="text-base font-extrabold text-foreground">{profile.name}</span>
            </div>
            
            <div className="flex flex-col gap-2.5">
              <div className="inline-flex items-center h-12 px-6 gap-3 rounded-full bg-muted/40 border border-border/40 shadow-sm w-fit">
                <span className="text-[13px] font-bold text-muted-foreground/60">레벨</span>
                <span className="text-base font-extrabold text-foreground">Lv.{profile.points?.level || 1}</span>
              </div>
              
              <div className="inline-flex items-center h-12 px-6 gap-3 rounded-full bg-muted/40 border border-border/40 shadow-sm w-fit">
                <span className="text-[13px] font-bold text-muted-foreground/60">가입일</span>
                <span className="text-base font-extrabold text-foreground">
                  {profile.createdAt ? format(new Date(profile.createdAt), 'yyyy.MM.dd(eee) HH:mm', { locale: ko }) : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs / Post Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-end gap-6 border-b pb-1 px-4">
          <button 
            onClick={() => { setActiveTab('posts'); handlePageChange(1); }}
            className={`text-sm font-black pb-3 transition-colors relative cursor-pointer ${
              activeTab === 'posts' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            작성글
            {activeTab === 'posts' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary -mb-[2px]" />
            )}
          </button>
          <button 
            onClick={() => { setActiveTab('comments'); handlePageChange(1); }}
            className={`text-sm font-black pb-3 transition-colors relative cursor-pointer ${
              activeTab === 'comments' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            댓글
            {activeTab === 'comments' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary -mb-[2px]" />
            )}
          </button>
        </div>

        {((activeTab === 'posts' && isPostsLoading) || 
          (activeTab === 'comments' && isCommentsLoading)) ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="bg-card border-x border-b border-border/50 shadow-sm">
              <Table>
                {activeTab === 'posts' ? (
                  <>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[100px] text-center font-bold">게시판</TableHead>
                        <TableHead className="font-bold">제목</TableHead>
                        <TableHead className="w-[80px] text-center font-bold">조회</TableHead>
                        <TableHead className="w-[80px] text-center font-bold">추천</TableHead>
                        <TableHead className="w-[100px] text-center font-bold">작성일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                            아직 작성한 게시글이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        posts.map((post) => {
                          const boardName = (post as any).board?.name || '일반';
                          const boardSlug = (post as any).board?.slug || 'all';

                          return (
                            <TableRow key={post.id} className="group cursor-pointer">
                              <TableCell className="text-center">
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground rounded-sm">
                                  {boardName}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Link 
                                  href={`/board/${boardSlug}/${post.id}`}
                                  className="flex items-center gap-2 hover:underline decoration-primary/30 underline-offset-4"
                                >
                                  <span className="font-medium truncate max-w-[300px] md:max-w-[400px]">
                                    {post.title}
                                  </span>
                                    {(post.commentCount ?? 0) > 0 && (
                                      <span className="text-primary text-xs font-bold shrink-0">
                                        [{post.commentCount}]
                                      </span>
                                    )}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground text-sm">
                                  {(post.viewCount || 0).toLocaleString()}
                                </TableCell>
                              <TableCell className="text-center text-green-600 dark:text-green-400 text-sm font-medium">
                                {post.likeCount || 0}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground text-sm">
                                {post.createdAt && (isToday(new Date(post.createdAt))
                                  ? format(new Date(post.createdAt), 'HH:mm')
                                  : format(new Date(post.createdAt), 'MM.dd'))}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </>
                ) : (
                  <>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold">댓글 내용</TableHead>
                        <TableHead className="w-[300px] font-bold">원문 제목</TableHead>
                        <TableHead className="w-[100px] text-center font-bold">작성일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!commentsData?.items || commentsData.items.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-40 text-center text-muted-foreground">
                            아직 작성한 댓글이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        commentsData.items.map((comment: any) => (
                          <TableRow key={comment.id} className="group cursor-pointer">
                            <TableCell>
                              <Link 
                                href={`/board/${comment.boardSlug || 'all'}/${comment.targetId}#comment-${comment.id}`}
                                className="font-medium hover:text-primary transition-colors block"
                              >
                                {comment.content}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link 
                                href={`/board/${comment.boardSlug || 'all'}/${comment.targetId}#comment-${comment.id}`}
                                className="text-sm text-muted-foreground truncate block max-w-[280px] hover:underline underline-offset-4"
                              >
                                {comment.postTitle || '삭제된 게시글'}
                              </Link>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground text-sm">
                              {comment.createdAt && (isToday(new Date(comment.createdAt))
                                ? format(new Date(comment.createdAt), 'HH:mm')
                                : format(new Date(comment.createdAt), 'MM.dd'))}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </>
                )}
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center py-4">
                <CommonPagination
                   currentPage={page}
                   totalPages={totalPages}
                   onPageChange={handlePageChange}
                />
              </div>
            )}

            {/* Bottom Search */}
            <div className="flex justify-center pt-8">
              <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-sm">
                <div className="relative flex-1 group">
                  <Input 
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    placeholder="검색어를 입력하세요" 
                    className="rounded-[5px] bg-muted/30 border-border/50 focus:ring-primary/20 pl-10 h-10 transition-all font-medium" 
                  />
                  <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Button type="submit" className="rounded-[5px] px-6 font-bold bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20">검색</Button>
              </form>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
