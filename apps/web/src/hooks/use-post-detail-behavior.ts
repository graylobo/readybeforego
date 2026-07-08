import { useAuthStore } from '@/lib/stores/auth.store';
import { useRecentBoardsStore } from '@/lib/stores/recent-boards.store';
import { useBoard, useDeletePost, usePost, useTogglePostReaction, useToggleScrap } from '@/hooks/queries/use-board-queries';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Post } from '@/lib/api/board';

interface UsePostDetailBehaviorProps {
  slug: string;
  postId: string;
  initialPost?: Post;
}

export function usePostDetailBehavior({ slug, postId, initialPost }: UsePostDetailBehaviorProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addBoard } = useRecentBoardsStore();

  const { data: board } = useBoard(slug);
  const { data: post, isLoading } = usePost(postId);
  
  const activePost = post || initialPost;

  useEffect(() => {
      if (board?.name && slug) {
          addBoard({ slug, name: board.name });
      }
  }, [board?.name, slug, addBoard]);

  const deletePostMutation = useDeletePost(slug);
  const toggleReactionMutation = useTogglePostReaction(postId);
  const toggleScrapMutation = useToggleScrap(postId);

  const handleScrap = () => {
      if (!user) {
          alert('로그인이 필요한 기능입니다.');
          return;
      }
      toggleScrapMutation.mutate(undefined, {
          onSuccess: (data) => {
              if (data.isScrapped) {
                  toast.success('게시글이 스크랩되었습니다.');
              } else {
                  toast.success('스크랩이 취소되었습니다.');
              }
          }
      });
  };

  const handleCopyLink = async () => {
      try {
          await navigator.clipboard.writeText(window.location.href);
          toast.success('게시글 주소가 복사되었습니다.');
      } catch (err) {
          toast.error('주소 복사에 실패했습니다.');
      }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const handleDelete = async () => {
      let guestPassword = '';
      if (!activePost?.userId && !isAdmin) {
        const password = prompt('비밀번호를 입력해주세요.');
        if (!password) return;
        guestPassword = password;
      } else {
        if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;
      }
  
      deletePostMutation.mutate({ id: postId, guestPassword }, {
          onSuccess: () => {
              router.push(`/board/${slug}`);
          }
      });
  };

  const handleReaction = (type: 'like' | 'dislike') => {
      toggleReactionMutation.mutate(type);
  };

  const isAnonymousPost = !activePost?.userId;
  const isAuthor = user?.id && activePost?.userId && user.id === activePost.userId;
  const canEdit = isAuthor || isAdmin || isAnonymousPost;

  return {
    board,
    activePost,
    isLoading,
    isPending: toggleScrapMutation.isPending || toggleReactionMutation.isPending || deletePostMutation.isPending,
    canEdit,
    handleScrap,
    handleCopyLink,
    handleDelete,
    handleReaction,
  };
}
