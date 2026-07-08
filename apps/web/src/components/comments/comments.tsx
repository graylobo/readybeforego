'use client';
import { CommonPagination } from '@/components/common/common-pagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useCommentsBehavior } from '@/hooks/use-comments-behavior';
import { CommentTargetType } from '@/lib/api/comments';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { CommentForm } from './comment-form';
import CommentItem from './comment-item';

/**
 * 공통 댓글 컴포넌트
 */
type CommentsProps = {
  targetType: CommentTargetType;
  targetId: string;
  defaultRepliesVisible?: boolean; 
  onMutationSuccess?: () => void; 
  allowAnonymous?: boolean; 
};

const generateRandomId = () => {
    const prefixes = ['이방인', '구경꾼', '나그네', '지나가던','손님'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${num}`;
};

export function Comments({
  targetType,
  targetId,
  defaultRepliesVisible = true,
  onMutationSuccess,
  allowAnonymous = false,
}: CommentsProps) {
  const {
    user,
    data,
    comments,
    bestComments,
    pagination,
    loading,
    isPlaceholderData,
    page,
    setPage,
    currentUrl,
    replyingTo,
    editingId,
    repliesVisible,
    actionsRef,
    createPending,
    updatePending,
    handleCreateComment,
    commentRefs,
  } = useCommentsBehavior({ targetType, targetId, defaultRepliesVisible, onMutationSuccess });

  if (loading && !isPlaceholderData) {
    return (
      <div className="mt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          댓글 {data?.total || 0}
        </h2>
      </div>

      {bestComments.length > 0 && (
        <div className="mb-8">
          <div className="space-y-2">
            {bestComments.map((comment) => (
              <CommentItem
                key={`${comment.id}-best`}
                comment={comment}
                allComments={comments}
                isTopLevel={true}
                isBest={true}
                isEditing={editingId === comment.id}
                isReplying={replyingTo === comment.id}
                isRepliesVisible={false}
                user={user}
                targetType={targetType}
                targetId={targetId}
                allowAnonymous={allowAnonymous}
                defaultRepliesVisible={defaultRepliesVisible}
                page={page}
                createPending={createPending}
                updatePending={updatePending}
                actionsRef={actionsRef}
                commentRefCallback={() => {}}
                editingId={editingId}
                replyingTo={replyingTo}
                repliesVisible={repliesVisible}
              />
            ))}
          </div>
        </div>
      )}

      {(!user && !allowAnonymous) ? (
        <div className="mb-8 p-6 bg-muted/50 rounded-xl text-center border-2 border-dashed">
          <p className="text-muted-foreground mb-3">로그인한 사용자만 댓글을 작성할 수 있습니다.</p>
          <Button asChild>
            <Link href={`/login?redirect=${currentUrl}`}>로그인하고 댓글 쓰기</Link>
          </Button>
        </div>
      ) : (
        <div className="mb-8 p-4 pb-1 bg-muted/30 rounded-xl">
          <CommentForm
            targetId={targetId}
            targetType={targetType}
            onSubmit={handleCreateComment}
            isPending={createPending}
            allowAnonymous={allowAnonymous}
          />
        </div>
      )}

      <div className={`space-y-1 divide-y divide-gray-100 dark:divide-gray-800 transition-opacity duration-200 ${isPlaceholderData ? 'opacity-50' : 'opacity-100'}`}>
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            allComments={comments}
            isTopLevel={true}
            isBest={false}
            isEditing={editingId === comment.id}
            isReplying={replyingTo === comment.id}
            isRepliesVisible={
              repliesVisible[comment.id] !== undefined
                ? repliesVisible[comment.id]
                : defaultRepliesVisible
            }
            user={user}
            targetType={targetType}
            targetId={targetId}
            allowAnonymous={allowAnonymous}
            defaultRepliesVisible={defaultRepliesVisible}
            page={page}
            createPending={createPending}
            updatePending={updatePending}
            actionsRef={actionsRef}
            commentRefCallback={(el) => { commentRefs.current[comment.id] = el; }}
            editingId={editingId}
            replyingTo={replyingTo}
            repliesVisible={repliesVisible}
          />
        ))}
      </div>

      {/* Pagination UI */}
      {pagination && pagination.totalPages > 1 && (
        <CommonPagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={(p) => {
                setPage(p);
                window.scrollTo({ top: commentRefs.current[comments[0]?.id]?.offsetTop ? commentRefs.current[comments[0]?.id]!.offsetTop - 100 : 0, behavior: 'smooth' });
            }}
            className="mt-8 pb-8"
        />
      )}


    </div>
  );
}
