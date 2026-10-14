import { useAuthStore } from '@/lib/stores/auth.store';
import { useRecentBoardsStore } from '@/lib/stores/recent-boards.store';
import { boardKeys, useBoard, useDeletePost, usePost, useTogglePostReaction, useSetPostHidden, useToggleScrap, useUpdatePost } from '@/hooks/queries/use-board-queries';
import { useBoardPermissions } from '@/hooks/queries/use-board-community-queries';
import { commentKeys } from '@/hooks/queries/use-comment-queries';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';
import { Board, boardApi, Post } from '@/lib/api/board';

interface UsePostDetailBehaviorProps {
  slug: string;
  postId: string;
  initialPost?: Post;
  initialBoard?: Board;
  initialIsForVisitor?: boolean;
}

export function usePostDetailBehavior({ slug, postId, initialPost, initialBoard, initialIsForVisitor = false }: UsePostDetailBehaviorProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addBoard } = useRecentBoardsStore();

  const queryClient = useQueryClient();
  const viewerId = user?.id;

  const { data: board } = useBoard(slug, initialBoard);
  // 서버 렌더링 결과(initialPost)는 비회원 기준이다 (로그인 쿠키는 API 도메인에 있음).
  // 비회원이고 방문자 IP로 조회된 값이면 그대로 쓰고, 아니면 내 추천·스크랩 여부를 위해 다시 받는다
  const { data: post, isLoading } = usePost(
    postId,
    initialPost ? { data: initialPost, isForViewer: !viewerId && initialIsForVisitor } : undefined,
  );

  const activePost = post || initialPost;

  // 화면을 연 뒤 로그인 정보가 확인되거나 바뀌면 내 기준으로 게시글/댓글을 다시 받는다
  const lastViewerRef = useRef(viewerId);
  useEffect(() => {
      if (lastViewerRef.current === viewerId) return;
      lastViewerRef.current = viewerId;
      queryClient.invalidateQueries({ queryKey: boardKeys.post(postId) });
      queryClient.invalidateQueries({ queryKey: commentKeys.lists('post', postId) });
  }, [viewerId, postId, queryClient]);

  // 조회수는 게시글을 다시 받지 않고 가벼운 요청으로 한 번만 기록
  const viewRecordedRef = useRef<string | null>(null);
  useEffect(() => {
      if (viewRecordedRef.current === postId) return;
      viewRecordedRef.current = postId;
      boardApi.recordView(postId)
          .then(({ viewCount }) => {
              queryClient.setQueryData<Post>(boardKeys.post(postId), (old) => (old ? { ...old, viewCount } : old));
          })
          .catch(() => {
              // 조회수 기록 실패는 화면 표시에 영향을 주지 않는다
          });
  }, [postId, queryClient]);

  useEffect(() => {
      if (board?.name && slug) {
          addBoard({ slug, name: board.name });
      }
  }, [board?.name, slug, addBoard]);

  const deletePostMutation = useDeletePost(slug);
  const updatePostMutation = useUpdatePost(slug, postId);
  // 게시판 관리자(매니저·부매니저)는 이 게시판의 남의 글도 지우고 공지로 올릴 수 있다
  const { canModerate } = useBoardPermissions(slug);
  const toggleReactionMutation = useTogglePostReaction(postId);
  const toggleScrapMutation = useToggleScrap(postId);
  const setHiddenMutation = useSetPostHidden(postId);

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
      if (!activePost?.userId && !isAdmin && !canModerate) {
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

  const handleToggleNotice = () => {
      const next = !activePost?.isNotice;
      updatePostMutation.mutate({ isNotice: next }, {
          onSuccess: () => toast.success(next ? '공지로 올렸습니다.' : '공지에서 내렸습니다.'),
      });
  };

  // 비공개: 글과 댓글은 남겨 두고 Super Admin 말고는 볼 수 없게 한다 (목록·검색·사이트맵에서도 빠짐)
  const handleToggleHidden = () => {
      const hide = !activePost?.hiddenAt;
      if (hide && !confirm('이 글을 비공개로 바꿀까요?\nSuper Admin 말고는 작성자도 볼 수 없게 됩니다. (언제든 다시 공개할 수 있습니다)')) return;
      setHiddenMutation.mutate(hide, {
          onSuccess: () => toast.success(hide ? '비공개로 바꿨습니다.' : '다시 공개했습니다.'),
          onError: () => toast.error('바꾸지 못했습니다. 잠시 후 다시 시도해주세요.'),
      });
  };

  const handleReaction = (type: 'like' | 'dislike') => {
      toggleReactionMutation.mutate(type);
  };

  const isAnonymousPost = !activePost?.userId;
  const isAuthor = user?.id && activePost?.userId && user.id === activePost.userId;
  const canEdit = isAuthor || isAdmin || isAnonymousPost;
  // 내용 수정은 작성자(비회원은 비밀번호)와 사이트 관리자만, 삭제는 게시판 관리자도
  const canDelete = canEdit || canModerate;

  return {
    board,
    activePost,
    isLoading,
    isPending: toggleScrapMutation.isPending || toggleReactionMutation.isPending || deletePostMutation.isPending || setHiddenMutation.isPending,
    canEdit,
    canDelete,
    canModerate,
    handleToggleNotice,
    handleToggleHidden,
    handleScrap,
    handleCopyLink,
    handleDelete,
    handleReaction,
  };
}
