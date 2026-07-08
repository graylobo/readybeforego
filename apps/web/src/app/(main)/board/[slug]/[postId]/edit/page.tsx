'use client';

import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  useBoard,
  usePost,
  useUpdatePost
} from '@/hooks/queries/use-board-queries';
import { useNavigationLock } from '@/hooks/use-navigation-lock';
import { boardApi } from '@/lib/api/board';
import { useAuthStore } from '@/lib/stores/auth.store';
import { cn } from '@/lib/utils/cn';
import { ArrowLeft, Loader2, Lock, Save } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function EditPostContent() {
  const params = useParams();
  const slug = params?.slug as string;
  const postId = params?.postId as string;
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: board } = useBoard(slug);
  const { data: post, isLoading: postLoading } = usePost(postId);

  const updatePostMutation = useUpdatePost(slug, postId);

  const searchParams = useSearchParams();
  const pw = searchParams.get('pw') || '';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isNotice, setIsNotice] = useState(false);
  const [isBest, setIsBest] = useState(false);
  const [guestPw, setGuestPw] = useState(searchParams.get('pw') || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [receiveCommentNotification, setReceiveCommentNotification] = useState(true);

  // 게시글 데이터로 폼 초기화
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setIsPinned(post.isPinned || false);
      setIsNotice(post.isNotice || false);
      setIsBest((post as any).isBest || false);
      setAllowComments(post.allowComments ?? true);
      setReceiveCommentNotification(post.receiveCommentNotification ?? true);
    }
  }, [post]);

  const isDirty = post && (title !== post.title || content !== post.content);
  useNavigationLock(!!isDirty && !updatePostMutation.isSuccess, '정말로 취소하시겠습니까?');

  if (postLoading) {
    return (
      <PageContainer className="md:px-10 py-8">
        <Skeleton className="mb-4 h-6 w-1/4" />
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  if (!post) {
    return (
      <PageContainer className="md:px-10 py-8">
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

  const isAnonymousPost = post && !post.userId;
  const isAuthor = user?.id && post?.userId && user.id === post.userId;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canEditDirectly = isAuthor || isAdmin;
  const canEdit = canEditDirectly || (isAnonymousPost && isVerified);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestPw) return;
    
    setIsVerifying(true);
    try {
      await boardApi.verifyPassword(postId, guestPw);
      setIsVerified(true);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!canEdit && isAnonymousPost && !canEditDirectly) {
    return (
      <PageContainer maxWidth="sm" className="md:px-10 py-8 max-w-md">
        <div className="bg-card border rounded-xl p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">비밀번호 확인</h2>
            <p className="text-sm text-muted-foreground mt-1">
              익명 게시글을 수정하려면 비밀번호가 필요합니다.
            </p>
          </div>
          
          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <input
              type="password"
              value={guestPw}
              onChange={(e) => setGuestPw(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-2 border rounded-md bg-background focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => router.back()}
              >
                취소
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isVerifying || !guestPw}
              >
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                확인
              </Button>
            </div>
          </form>
        </div>
      </PageContainer>
    );
  }

  if (!canEdit) {
    return (
      <PageContainer className="md:px-10 py-8">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            권한이 없습니다
          </h2>
          <p className="text-muted-foreground mb-4">
            본인이 작성한 글만 수정할 수 있습니다.
          </p>
          <Button onClick={() => router.push(`/board/${slug}/${postId}`)}>
            게시글로 돌아가기
          </Button>
        </div>
      </PageContainer>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (!content.trim() || content === '<p></p>') {
      alert('내용을 입력해주세요.');
      return;
    }

    updatePostMutation.mutate({
      title: title.trim(),
      content,
      allowComments,
      receiveCommentNotification,
      ...(isAdmin && { isPinned, isNotice, isBest }),
      guestPassword: (isAnonymousPost && guestPw) ? guestPw : undefined,
    }, {
        onSuccess: () => {
            router.push(`/board/${slug}/${postId}`);
        },
        onError: () => {
            // 에러 인터셉터에서 처리됨
        }
    });
  };

  return (
    <PageContainer className="md:px-10 py-8">
      {/* Back Button */}
      <Link
        href={`/board/${slug}/${postId}`}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>게시글로 돌아가기</span>
      </Link>

      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground mb-6">글 수정</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full px-4 py-3 text-lg border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={200}
          />
        </div>

        {/* Admin Options */}
        {isAdmin && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">고정글</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isNotice}
                onChange={(e) => setIsNotice(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">공지</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBest}
                onChange={(e) => setIsBest(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">베스트</span>
            </label>
          </div>
        )}

        {/* Content Editor */}
        <div>
          <TiptapEditor
            content={content}
            onChange={setContent}
            placeholder="내용을 입력하세요..."
            className="min-h-[400px]"
          />
        </div>

        {/* Post Options */}
        <div className="flex flex-col gap-4 p-5 border rounded-lg bg-card mt-4">
           <h3 className="text-sm font-bold text-foreground">게시글 옵션</h3>
           <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
               <div className="flex items-center gap-3">
                 <Switch
                    checked={allowComments}
                    onCheckedChange={(checked) => {
                       setAllowComments(checked);
                       if (!checked) setReceiveCommentNotification(false);
                    }}
                 />
                 <span 
                   className="text-sm font-medium text-foreground cursor-pointer select-none" 
                   onClick={() => {
                      const newValue = !allowComments;
                      setAllowComments(newValue);
                      if (!newValue) setReceiveCommentNotification(false);
                   }}
                 >
                   댓글 허용
                 </span>
              </div>
            {user && (
                <div className="flex items-center gap-3 space-x-2">
                   <Switch
                      checked={receiveCommentNotification}
                      onCheckedChange={setReceiveCommentNotification}
                      disabled={!allowComments}
                   />
                   <span 
                     className={cn(
                        "text-sm font-medium select-none", 
                        allowComments ? "text-foreground cursor-pointer" : "text-muted-foreground/50 cursor-not-allowed"
                     )} 
                     onClick={() => {
                        if (allowComments) {
                           setReceiveCommentNotification(!receiveCommentNotification);
                        }
                     }}
                   >
                     댓글 알림 받기
                   </span>
                </div>
              )}
           </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={updatePostMutation.isPending}
          >
            {updatePostMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {updatePostMutation.isPending ? '저장 중...' : '수정 완료'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

export default function EditPostPage() {
  return (
    <Suspense fallback={
       <PageContainer className="md:px-10 py-8">
        <Skeleton className="mb-4 h-6 w-1/4" />
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </PageContainer>
    }>
      <EditPostContent />
    </Suspense>
  );
}
