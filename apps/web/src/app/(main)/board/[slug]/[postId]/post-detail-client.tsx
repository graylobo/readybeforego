'use client';

import { RecentBoards } from '@/components/board/recent-boards';
import { Comments } from '@/components/comments/comments';
import { ReactionButtons } from '@/components/common/reaction-buttons';
import { UserProfilePopover } from '@/components/common/user-profile-popover';
import { TiptapViewer } from '@/components/editor/tiptap-editor';
import { PageContainer } from '@/components/layout/page-container';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DelayedRender } from "@/components/ui/delayed-render";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostDetailBehavior } from '@/hooks/use-post-detail-behavior';
import { Post } from '@/lib/api/board';
import { cn } from '@/lib/utils/cn';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Bookmark, BookmarkCheck, Link as LinkIcon, Pencil, Trash2, Flag } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ReportDialog } from '@/components/common/report-dialog';
import { TimeDisplay } from '@/components/common/time-display';

interface PostDetailClientProps {
  slug: string;
  postId: string;
  initialPost?: Post;
}

export function PostDetailClient({ slug, postId, initialPost }: PostDetailClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { 
        board, 
        activePost, 
        isLoading, 
        isPending, 
        canEdit, 
        handleScrap, 
        handleCopyLink, 
        handleDelete, 
        handleReaction 
    } = usePostDetailBehavior({ slug, postId, initialPost });
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => {
        // 상세페이지에 성공적으로 진입하면 목록 데이터를 stale 처리하여
        // 뒤로가기 시 1 증가한 조회수 및 달린 댓글 수가 즉각 반영되도록 함
        queryClient.invalidateQueries({ queryKey: ['boards', 'posts'] });
    }, [queryClient]);

    useEffect(() => {
        const isFocusComment = searchParams?.get('focusComment') === 'true';
        if (isFocusComment) {
            const timer = setTimeout(() => {
                const textarea = document.getElementById('root-comment-textarea') as HTMLTextAreaElement;
                if (textarea) {
                    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    textarea.focus();
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    if (isLoading && !initialPost) {
        return (
            <DelayedRender>
                <PageContainer className="md:px-10 py-4 md:py-8">
                    <Skeleton className="mb-4 h-6 w-1/4" />
                    <Skeleton className="mb-8 h-10 w-3/4" />
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full rounded-lg" />
                        <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                </PageContainer>
            </DelayedRender>
        );
    }

    if (!activePost) {
        return (
             <PageContainer className="md:px-10 py-4 md:py-8">
                <div className="text-center py-16">
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    게시글을 찾을 수 없습니다
                  </h2>
                  <Button onClick={() => router.push(`/board/${slug}`)}>
                    목록으로 돌아가기
                  </Button>
                </div>
              </PageContainer>
        );
    }

    return (
        <PageContainer className="md:px-10 py-4 md:py-8 min-h-screen">
              <RecentBoards />

              <article className="max-w-screen-xl mx-auto">
                <header className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        {activePost.category && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-muted text-muted-foreground rounded-sm">
                                {activePost.category}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                            {activePost.title}
                        </h1>
                        <div className="flex items-center gap-1 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full transition-all text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                                onClick={handleCopyLink}
                                title="주소 복사"
                            >
                                <LinkIcon className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full transition-all text-muted-foreground/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => setIsReportOpen(true)}
                                title="신고하기"
                            >
                                <Flag className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "rounded-full transition-all",
                                    activePost.isScrapped ? "text-primary hover:text-primary/80 bg-primary/5" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/5"
                                )}
                                onClick={handleScrap}
                                disabled={isPending}
                                title={activePost.isScrapped ? "스크랩 취소" : "스크랩"}
                            >
                                {activePost.isScrapped ? (
                                    <BookmarkCheck className="h-6 w-6 fill-current" />
                                ) : (
                                    <Bookmark className="h-6 w-6" />
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <UserProfilePopover
                                userId={activePost.userId}
                                userName={activePost.user?.name || activePost.guestName || '익명'}
                                userPicture={activePost.user?.picture}
                                className="flex items-center gap-2 no-underline hover:no-underline"
                            >
                                {activePost.user?.picture ? (
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={activePost.user.picture} />
                                        <AvatarFallback>{activePost.user.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                        익
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-foreground hover:underline">
                                        {activePost.user?.name || activePost.guestName || '익명'}
                                    </span>
                                </div>
                            </UserProfilePopover>
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                                <span className="text-muted-foreground/30">|</span>
                                <span className="text-muted-foreground italic">
                                    <TimeDisplay 
                                        date={activePost.createdAt}
                                        formattedDate={format(new Date(activePost.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                                    />
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                            <span>조회수 {activePost.viewCount}</span>
                            <span className="text-muted-foreground/30">|</span>
                            <span>추천 {activePost.likeCount || 0}</span>
                            <span className="text-muted-foreground/30">|</span>
                            <span>댓글 {activePost.commentCount || 0}</span>
                        </div>
                    </div>
                </header>

                <div className="min-h-[300px]">
                    <TiptapViewer content={activePost.content} className="border-none p-0" />
                </div>

                {/* Reaction Buttons */}
                <div className="py-12 flex justify-center border-t border-border/40">
                    <ReactionButtons 
                        likeCount={activePost.likeCount || 0}
                        dislikeCount={activePost.dislikeCount || 0}
                        userReaction={activePost.userReaction}
                        onLike={() => handleReaction('like')}
                        onDislike={() => handleReaction('dislike')}
                        isLoading={isPending}
                    />
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center justify-end gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold px-4 rounded-md shadow-sm"
                      onClick={() => router.push(`/board/${slug}/${postId}/edit`)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      수정
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs font-semibold px-4 rounded-md shadow-sm"
                      onClick={handleDelete}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      삭제
                    </Button>
                  </div>
                )}
              </article>
              
              {/* Comments Section */}
              {activePost.allowComments !== false ? (
                  <section className="mt-16 pt-8 border-t border-border/40 max-w-screen-xl mx-auto">
                    <Suspense fallback={
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full rounded-xl" />
                            <Skeleton className="h-24 w-full rounded-xl" />
                        </div>
                    }>
                        <Comments 
                            targetType="post" 
                            targetId={postId} 
                            allowAnonymous={board?.allowAnonymous}
                        />
                    </Suspense>
                  </section>
              ) : (
                  <section className="mt-16 pt-8 border-t border-border/40 max-w-screen-xl mx-auto">
                      <div className="py-12 text-center text-muted-foreground bg-muted/30 rounded-xl">
                          작성자가 댓글 작성을 허용하지 않은 게시글입니다.
                      </div>
                  </section>
              )}

              <ReportDialog
                  isOpen={isReportOpen}
                  onClose={() => setIsReportOpen(false)}
                  targetType="POST"
                  targetId={postId}
              />
        </PageContainer>
    );
}
