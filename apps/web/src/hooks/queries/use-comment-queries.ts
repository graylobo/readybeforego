import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { commentsApi, CommentTargetType, CreateCommentDto, UpdateCommentDto, CommentTree } from '@/lib/api/comments';
import { Post } from '@/lib/api/board';
import { boardKeys } from './use-board-queries';

export const commentKeys = {
  all: ['comments'] as const,
  lists: (targetType: CommentTargetType, targetId: string) => [...commentKeys.all, targetType, targetId] as const,
  list: (targetType: CommentTargetType, targetId: string, page: number, limit: number) => 
    [...commentKeys.lists(targetType, targetId), { page, limit }] as const,
};

export function useComments(targetType: CommentTargetType, targetId: string, page: number = 1, limit: number = 100) {
  return useQuery({
    queryKey: commentKeys.list(targetType, targetId, page, limit),
    queryFn: () => commentsApi.getComments(targetType, targetId, page, limit),
    enabled: !!targetId,
    placeholderData: keepPreviousData, // 이전 데이터를 유지하여 깜빡임 방지
  });
}

export function useUserComments(userId: string, page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: [...commentKeys.all, 'user', userId, { page, limit }],
    queryFn: () => commentsApi.getUserComments(userId, page, limit),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function useCreateComment(targetType: CommentTargetType, targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCommentDto) => commentsApi.createComment(dto),
    onSuccess: async (data: { commentCount?: number }) => {
      // 해당 target의 모든 댓글 관련 쿼리 무효화 (모든 페이지/리미트 조합 포함)
      await queryClient.invalidateQueries({ queryKey: commentKeys.lists(targetType, targetId) });
      
      if (targetType === 'post' && data.commentCount !== undefined) {
        // 서버에서 받아온 정확한 카운트로 캐시 업데이트
        queryClient.setQueryData(boardKeys.post(targetId), (old: Post | undefined) => {
          if (!old) return old;
          return {
            ...old,
            commentCount: data.commentCount
          };
        });
        // 게시물 목록은 무효화
        queryClient.invalidateQueries({ queryKey: boardKeys.lists() });
        queryClient.invalidateQueries({ queryKey: ['boards', 'posts'] });
      }

      // 포인트 정보 무효화
      queryClient.invalidateQueries({ queryKey: ['points'] });

      // 작성자(유저)의 댓글 목록 쿼리 무효화 (프로필 탭 갱신용)
      queryClient.invalidateQueries({ queryKey: [...commentKeys.all, 'user'] });
    },
  });
}

export function useUpdateComment(targetType: CommentTargetType, targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string } & UpdateCommentDto) => {
      const { id, ...dto } = data;
      return commentsApi.updateComment(id, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists(targetType, targetId) });
    },
  });
}

export function useDeleteComment(targetType: CommentTargetType, targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; guestPassword?: string; removedCount?: number }) => 
      commentsApi.deleteComment(data.id, data.guestPassword),
    onSuccess: (data: { commentCount?: number }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists(targetType, targetId) });
      
      if (targetType === 'post' && data.commentCount !== undefined) {
        // 서버에서 계산된 정확한 카운트로 캐시 업데이트
        queryClient.setQueryData(boardKeys.post(targetId), (old: Post | undefined) => {
          if (!old) return old;
          return {
            ...old,
            commentCount: data.commentCount
          };
        });
        queryClient.invalidateQueries({ queryKey: boardKeys.lists() });
        queryClient.invalidateQueries({ queryKey: ['boards', 'posts'] });
      }

      // 작성자(유저)의 댓글 목록 쿼리 무효화 (프로필 탭 갱신용)
      queryClient.invalidateQueries({ queryKey: [...commentKeys.all, 'user'] });
    },
  });
}

// 댓글 트리 내 특정 댓글을 찾아 반응을 업데이트하는 헬퍼 함수
const updateCommentInTree = (tree: CommentTree[], id: string, type: 'like' | 'dislike'): CommentTree[] => {
  return tree.map(comment => {
    if (comment.id === id) {
      let upvoteCount = comment.upvoteCount;
      let downvoteCount = comment.downvoteCount;
      let isUpvoted = comment.isUpvoted;
      let isDownvoted = comment.isDownvoted;

      if (type === 'like') {
        if (isUpvoted) {
          isUpvoted = false;
          upvoteCount--;
        } else {
          if (isDownvoted) {
            isDownvoted = false;
            downvoteCount--;
          }
          isUpvoted = true;
          upvoteCount++;
        }
      } else {
        if (isDownvoted) {
          isDownvoted = false;
          downvoteCount--;
        } else {
          if (isUpvoted) {
            isUpvoted = false;
            upvoteCount--;
          }
          isDownvoted = true;
          downvoteCount++;
        }
      }

      return {
        ...comment,
        upvoteCount: Math.max(0, upvoteCount),
        downvoteCount: Math.max(0, downvoteCount),
        isUpvoted,
        isDownvoted,
      };
    }
    
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, id, type)
      };
    }
    
    return comment;
  });
};


export function useToggleCommentReaction(targetType: CommentTargetType, targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; type: 'like' | 'dislike' }) => 
      commentsApi.toggleReaction(data.id, data.type),
    onMutate: async (variables) => {
      const { id, type } = variables;
      const queryKey = commentKeys.list(targetType, targetId, 1, 100); // 기본 페이지/리미트 스냅샷

      // 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: commentKeys.lists(targetType, targetId) });

      // 이전 상태 스냅샷
      const previousData = queryClient.getQueryData<any>(queryKey);

      // 낙관적 업데이트
      if (previousData) {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            comments: updateCommentInTree(old.comments || [], id, type),
            bestComments: updateCommentInTree(old.bestComments || [], id, type),
          };
        });
      }

      return { previousData, queryKey };
    },
    onError: (err, variables, context) => {
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists(targetType, targetId) });
    },
  });
}
