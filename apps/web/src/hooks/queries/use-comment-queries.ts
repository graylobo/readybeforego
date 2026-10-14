import { useQuery, useMutation, useQueryClient, keepPreviousData, QueryClient } from '@tanstack/react-query';
import { commentsApi, CommentListData, CommentTargetType, CreateCommentDto, UpdateCommentDto, CommentTree } from '@/lib/api/comments';
import { Post } from '@/lib/api/board';
import { boardKeys } from './use-board-queries';

export const commentKeys = {
  all: ['comments'] as const,
  lists: (targetType: CommentTargetType, targetId: string) => [...commentKeys.all, targetType, targetId] as const,
  list: (targetType: CommentTargetType, targetId: string, page: number, limit: number) =>
    [...commentKeys.lists(targetType, targetId), { page, limit }] as const,
};

/**
 * @param initial 서버 렌더링에서 받은 첫 페이지. isForViewer(지금 보는 사람 기준으로 조회된 값)이면 그대로 쓰고,
 *   아니면(로그인 사용자, 방문자 IP를 전달하지 못한 경우) 먼저 보여준 뒤 내 추천 여부를 위해 다시 받는다
 */
export function useComments(
  targetType: CommentTargetType,
  targetId: string,
  page: number = 1,
  limit: number = 100,
  initial?: { data: CommentListData; isForViewer: boolean },
) {
  const useInitial = !!initial && page === 1 && initial.data.pagination.limit === limit;
  return useQuery({
    queryKey: commentKeys.list(targetType, targetId, page, limit),
    queryFn: () => commentsApi.getComments(targetType, targetId, page, limit),
    enabled: !!targetId,
    // 다른 대상(예: 지도에서 다른 제보)으로 바뀌면 이전 대상의 댓글을 잠깐이라도 보여주지 않는다
    placeholderData: (previousData, previousQuery) => {
      const prevTargetId = previousQuery?.queryKey?.[2];
      return prevTargetId === targetId ? previousData : undefined;
    },
    ...(useInitial && {
      initialData: initial!.data,
      initialDataUpdatedAt: initial!.isForViewer ? undefined : 0,
      staleTime: 30_000,
    }),
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

// ---- 댓글 트리 캐시 직접 수정 (작성/수정/삭제/추천 후 목록 전체를 다시 받지 않기 위함) ----

/** 트리에서 id 댓글을 찾아 fn 결과로 바꾼다 */
function updateInTree(tree: CommentTree[], id: string, fn: (comment: CommentTree) => CommentTree): CommentTree[] {
  return tree.map((comment) => {
    if (comment.id === id) return fn(comment);
    if (comment.replies.length > 0) return { ...comment, replies: updateInTree(comment.replies, id, fn) };
    return comment;
  });
}

/** 트리에서 parentId 댓글의 답글 끝에 reply를 붙인다 (부모가 이 페이지에 없으면 그대로) */
function insertReply(tree: CommentTree[], parentId: string, reply: CommentTree): { tree: CommentTree[]; inserted: boolean } {
  let inserted = false;
  const next = updateInTree(tree, parentId, (parent) => {
    inserted = true;
    return { ...parent, replies: [...parent.replies, reply] };
  });
  return { tree: next, inserted };
}

/** 같은 대상의 모든 댓글 목록 캐시(페이지별)에 fn을 적용 */
function updateCommentLists(
  queryClient: QueryClient,
  targetType: CommentTargetType,
  targetId: string,
  fn: (data: CommentListData) => CommentListData,
) {
  queryClient.setQueriesData<CommentListData>({ queryKey: commentKeys.lists(targetType, targetId) }, (old) =>
    old ? fn(old) : old,
  );
}

/** 캐시를 직접 고친 뒤, 다른 페이지/다음 방문 때는 서버 값으로 다시 맞추도록 '오래됨' 표시만 한다 (지금 다시 받지 않음) */
function markCommentListsStale(queryClient: QueryClient, targetType: CommentTargetType, targetId: string) {
  queryClient.invalidateQueries({ queryKey: commentKeys.lists(targetType, targetId), refetchType: 'none' });
}

function setPostCommentCount(queryClient: QueryClient, postId: string, commentCount: number) {
  queryClient.setQueryData(boardKeys.post(postId), (old: Post | undefined) =>
    old ? { ...old, commentCount } : old,
  );
  // 게시글 목록의 댓글 수는 다음에 볼 때 다시 받는다
  queryClient.invalidateQueries({ queryKey: boardKeys.allPosts() });
}

export function useCreateComment(targetType: CommentTargetType, targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCommentDto) => commentsApi.createComment(dto),
    onSuccess: ({ comment, commentCount }) => {
      updateCommentLists(queryClient, targetType, targetId, (old) => {
        if (comment.parentId) {
          const { tree, inserted } = insertReply(old.comments, comment.parentId, comment);
          return inserted ? { ...old, comments: tree, total: old.total + 1 } : { ...old, total: old.total + 1 };
        }
        // 새 댓글은 맨 마지막 페이지 끝에 붙는다 (오래된 순 정렬)
        const totalRootCount = old.pagination.totalRootCount + 1;
        const totalPages = Math.ceil(totalRootCount / old.pagination.limit);
        const isLastPage = old.pagination.page === totalPages;
        return {
          ...old,
          comments: isLastPage ? [...old.comments, comment] : old.comments,
          total: old.total + 1,
          pagination: { ...old.pagination, totalRootCount, totalPages },
        };
      });
      markCommentListsStale(queryClient, targetType, targetId);

      if (targetType === 'post' && commentCount !== undefined) {
        setPostCommentCount(queryClient, targetId, commentCount);
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
    onSuccess: (updated, { id }) => {
      const apply = (comment: CommentTree): CommentTree => ({
        ...comment,
        content: updated.content,
        emoticonUrl: updated.emoticonUrl,
        imageUrl: updated.imageUrl,
        updatedAt: updated.updatedAt,
      });
      updateCommentLists(queryClient, targetType, targetId, (old) => ({
        ...old,
        comments: updateInTree(old.comments, id, apply),
        bestComments: updateInTree(old.bestComments, id, apply),
      }));
      markCommentListsStale(queryClient, targetType, targetId);
      queryClient.invalidateQueries({ queryKey: [...commentKeys.all, 'user'] });
    },
  });
}

export function useDeleteComment(targetType: CommentTargetType, targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; guestPassword?: string; deleteMode?: 'soft' | 'hard' }) =>
      commentsApi.deleteComment(data.id, data.guestPassword, data.deleteMode),
    onSuccess: (data, { id, deleteMode }) => {
      if (deleteMode === 'hard') {
        // 완전 삭제는 답글까지 함께 지워지므로 서버 기준으로 다시 받는다
        queryClient.invalidateQueries({ queryKey: commentKeys.lists(targetType, targetId) });
      } else {
        const markDeleted = (comment: CommentTree): CommentTree => ({
          ...comment,
          isDeleted: true,
          content: '삭제된 댓글입니다.',
          emoticonUrl: null,
          imageUrl: null,
          upvoteCount: 0,
          downvoteCount: 0,
          isUpvoted: false,
          isDownvoted: false,
        });
        updateCommentLists(queryClient, targetType, targetId, (old) => ({
          ...old,
          comments: updateInTree(old.comments, id, markDeleted),
          bestComments: old.bestComments.filter((comment) => comment.id !== id),
          total: Math.max(0, old.total - 1),
        }));
        markCommentListsStale(queryClient, targetType, targetId);
      }

      if (targetType === 'post' && data.commentCount !== undefined) {
        setPostCommentCount(queryClient, targetId, data.commentCount);
      }

      // 작성자(유저)의 댓글 목록 쿼리 무효화 (프로필 탭 갱신용)
      queryClient.invalidateQueries({ queryKey: [...commentKeys.all, 'user'] });
    },
  });
}

// 추천/비추천을 누른 직후 화면에 먼저 반영할 값 (취소, 반대 반응에서 전환 포함)
const toggleReactionLocally = (comment: CommentTree, type: 'like' | 'dislike'): CommentTree => {
  let { upvoteCount, downvoteCount, isUpvoted, isDownvoted } = comment;

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
};

export function useToggleCommentReaction(targetType: CommentTargetType, targetId: string) {
  const queryClient = useQueryClient();
  const listsKey = commentKeys.lists(targetType, targetId);
  return useMutation({
    mutationFn: (data: { id: string; type: 'like' | 'dislike' }) =>
      commentsApi.toggleReaction(data.id, data.type),
    onMutate: async ({ id, type }) => {
      // 진행 중인 refetch가 낙관적 업데이트를 덮어쓰지 않도록 취소
      await queryClient.cancelQueries({ queryKey: listsKey });

      // 이 글의 모든 페이지 캐시를 스냅샷 후 즉시 반영 (화면에 보이는 페이지가 어느 것이든 적용)
      const previous = queryClient.getQueriesData<CommentListData>({ queryKey: listsKey });
      const apply = (comment: CommentTree) => toggleReactionLocally(comment, type);
      updateCommentLists(queryClient, targetType, targetId, (old) => ({
        ...old,
        comments: updateInTree(old.comments, id, apply),
        bestComments: updateInTree(old.bestComments, id, apply),
      }));

      return { previous };
    },
    onError: (_err, _variables, context) => {
      context?.previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSuccess: (result, { id }) => {
      // 서버가 돌려준 실제 값으로 맞춘다 (다른 사람의 반응이 그 사이 반영됐을 수 있음)
      const apply = (comment: CommentTree): CommentTree => ({
        ...comment,
        upvoteCount: result.upvoteCount,
        downvoteCount: result.downvoteCount,
        isUpvoted: result.userReaction === 'like',
        isDownvoted: result.userReaction === 'dislike',
      });
      updateCommentLists(queryClient, targetType, targetId, (old) => ({
        ...old,
        comments: updateInTree(old.comments, id, apply),
        bestComments: updateInTree(old.bestComments, id, apply),
      }));
      // 베스트 댓글 순위 등은 다음에 볼 때 서버 기준으로 다시 맞춘다
      markCommentListsStale(queryClient, targetType, targetId);
    },
  });
}
