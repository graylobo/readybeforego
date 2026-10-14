import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Board, boardApi, BoardPageData, BoardPageParams, Post } from '@/lib/api/board';
export type { Post };

export const boardKeys = {
  all: ['boards'] as const,
  lists: () => [...boardKeys.all, 'list'] as const,
  detail: (slug: string) => [...boardKeys.all, 'detail', slug] as const,
  // 모든 게시글 목록(게시판 화면, 전체/베스트 게시판, 최근 글 등)의 공통 접두사
  allPosts: () => [...boardKeys.all, 'posts'] as const,
  post: (id: string) => [...boardKeys.all, 'post', id] as const,
  scrapped: (page: number = 1) => [...boardKeys.all, 'scrapped', { page }] as const,
  // 'posts' 아래에 두어 게시글 목록을 무효화/갱신하는 기존 코드가 게시판 화면 데이터에도 함께 적용되게 한다
  boardPage: (slug: string, params: BoardPageParams, viewerId: string) =>
    [...boardKeys.all, 'posts', 'board-page', slug, params, viewerId] as const,
};

/**
 * 게시글 목록 형태의 캐시 데이터({ items }) 또는 게시판 화면 데이터({ notices, best, posts: { items } })의
 * 모든 게시글에 fn을 적용한다. (추천 등 낙관적 업데이트에서 두 형태를 함께 처리)
 */
function mapPostsInListData(data: any, fn: (post: any) => any) {
  if (!data) return data;
  if (Array.isArray(data.items)) return { ...data, items: data.items.map(fn) };
  if (data.posts && Array.isArray(data.posts.items)) {
    return {
      ...data,
      notices: (data.notices ?? []).map(fn),
      best: (data.best ?? []).map(fn),
      posts: { ...data.posts, items: data.posts.items.map(fn) },
    };
  }
  return data;
}

export function useBoards(initialData?: Board[]) {
  return useQuery({
    queryKey: boardKeys.lists(),
    queryFn: () => boardApi.getBoards(),
    // 서버에서 받은 목록으로 바로 그리되, 오래됐을 수 있으니 화면이 뜨면 다시 받는다
    initialData,
    initialDataUpdatedAt: 0,
  });
}

export function useBoard(slug: string, initialBoard?: Board) {
  return useQuery({
    queryKey: boardKeys.detail(slug),
    queryFn: () => boardApi.getBoard(slug),
    enabled: !!slug,
    // 서버 렌더링에서 이미 받은 게시판 정보가 있으면 그대로 쓰고 바로 다시 요청하지 않는다
    // (게시판 정보는 사용자마다 다르지 않고, API도 60초 캐시)
    ...(initialBoard && { initialData: initialBoard, staleTime: 60_000 }),
  });
}

export function usePosts(
  boardSlug?: string, 
  page = 1, 
  limit = 20,
  searchType?: string,
  searchQuery?: string,
  authorId?: string,
  isBest?: string,
  isNotice?: string,
  options?: { enabled?: boolean; includeContent?: boolean }
) {
  const includeContent = options?.includeContent;
  return useQuery({
    queryKey: [...boardKeys.all, 'posts', boardSlug || 'all', { page, limit, searchType, searchQuery, authorId, isBest, isNotice, includeContent }],
    queryFn: () => boardApi.getPosts(boardSlug, page, limit, searchType, searchQuery, authorId, isBest, isNotice, includeContent),
    enabled: options?.enabled ?? true, 
    placeholderData: (previousData: any) => previousData,
  });
}

/**
 * 게시판 화면 데이터 (게시판 정보 + 공지/인기글 + 목록을 한 번의 요청으로)
 *
 * 서버 렌더링 결과(initialData)는 비로그인 기준이다. (로그인 쿠키는 API 주소에만 있어 웹 서버 요청에 실리지 않음)
 * - 비로그인 + 방문자 IP 기준으로 조회됨(isForVisitor): 같은 조건이면 그대로 쓰고 다시 요청하지 않는다
 * - 그 밖(로그인, IP 미전달): 서버 렌더링 결과를 먼저 보여주면서 내 반응/비공개 게시판 글이 반영된 목록을 받아 바꾼다
 */
export function useBoardPage(
  slug: string,
  params: BoardPageParams,
  viewerId: string | undefined,
  initial?: { params: BoardPageParams; data: BoardPageData; isForVisitor: boolean },
) {
  const viewerKey = viewerId ?? 'guest';
  const matchesInitial =
    !!initial &&
    initial.params.page === params.page &&
    initial.params.limit === params.limit &&
    (initial.params.searchQuery || '') === (params.searchQuery || '') &&
    (!params.searchQuery || initial.params.searchType === params.searchType);
  const useInitialAsData = matchesInitial && viewerKey === 'guest' && initial!.isForVisitor;

  return useQuery({
    queryKey: boardKeys.boardPage(slug, params, viewerKey),
    queryFn: () => boardApi.getBoardPage(slug, params),
    enabled: !!slug,
    ...(useInitialAsData && { initialData: initial!.data, staleTime: 30_000 }),
    placeholderData: (previousData: BoardPageData | undefined) =>
      previousData ?? (matchesInitial ? initial!.data : undefined),
  });
}

/**
 * @param initial 서버 렌더링에서 받은 게시글. isForViewer(지금 보는 사람 기준으로 조회된 값)이면 그대로 쓰고,
 *   아니면(로그인 사용자, 방문자 IP를 전달하지 못한 경우) 먼저 보여준 뒤 내 추천/스크랩 여부를 위해 다시 받는다.
 *   조회수는 이 요청이 아니라 boardApi.recordView로 따로 기록한다
 */
export function usePost(id: string, initial?: { data: Post; isForViewer: boolean }) {
  return useQuery({
    queryKey: boardKeys.post(id),
    queryFn: () => boardApi.getPost(id),
    enabled: !!id,
    // 추천/댓글 등 부가 작업은 캐시를 직접 고치므로 자주 다시 받을 필요가 없다
    staleTime: 1000 * 60 * 5,
    // 없는 글·비공개 처리한 글·권한 없음(4xx)은 다시 받아도 같으니 바로 "찾을 수 없음"을 보여준다 (기본값은 3번 더 시도해 몇 초간 빈 화면)
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      return !(status >= 400 && status < 500) && failureCount < 3;
    },
    // 화면이 "게시글을 찾을 수 없습니다"를 직접 보여주므로 같은 내용의 알림을 띄우지 않는다
    meta: { preventToast: true },
    ...(initial && {
      initialData: initial.data,
      initialDataUpdatedAt: initial.isForViewer ? undefined : 0,
    }),
  });
}

export function useCreatePost(boardSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => boardApi.createPost(boardSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.allPosts() });
      queryClient.invalidateQueries({ queryKey: ['points'] });
    },
  });
}

export function useUpdatePost(boardSlug: string, postId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => boardApi.updatePost(postId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.post(postId) });
            queryClient.invalidateQueries({ queryKey: boardKeys.allPosts() });
        },
    });
}

/** 게시글 비공개/공개 전환 (Super Admin). 상세와 목록을 다시 받아 표시를 맞춘다 */
export function useSetPostHidden(postId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (hidden: boolean) => boardApi.setPostHidden(postId, hidden),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.post(postId) });
            queryClient.invalidateQueries({ queryKey: boardKeys.allPosts() });
        },
    });
}

export function useDeletePost(boardSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { id: string; guestPassword?: string }) => 
            boardApi.deletePost(data.id, data.guestPassword),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.allPosts() });
        },
    });
}

export function useTogglePostReaction(postId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (type: 'like' | 'dislike') => boardApi.togglePostReaction(postId, type),
        onMutate: async (type) => {
            // 진행 중인 refetch 취소
            await queryClient.cancelQueries({ queryKey: boardKeys.post(postId) });
            await queryClient.cancelQueries({ queryKey: ['boards', 'posts'] });

            // 이전 상태 스냅샷
            const previousPost = queryClient.getQueryData<Post>(boardKeys.post(postId));
            const previousQueries = queryClient.getQueriesData({ queryKey: ['boards', 'posts'] });

            // 1. 상세페이지 낙관적 업데이트 수행
            if (previousPost) {
                queryClient.setQueryData<Post>(boardKeys.post(postId), (oldData) => {
                    if (!oldData) return oldData;
                    
                    const newReaction = type === oldData.userReaction ? null : type;
                    let newLikeCount = Number(oldData.likeCount || 0);
                    let newDislikeCount = Number(oldData.dislikeCount || 0);

                    // 기존 반응 제거
                    if (oldData.userReaction === 'like') newLikeCount--;
                    if (oldData.userReaction === 'dislike') newDislikeCount--;

                    // 새로운 반응 추가
                    if (newReaction === 'like') newLikeCount++;
                    if (newReaction === 'dislike') newDislikeCount++;

                    return {
                        ...oldData,
                        userReaction: newReaction,
                        likeCount: Math.max(0, newLikeCount),
                        dislikeCount: Math.max(0, newDislikeCount),
                    };
                });
            }

            // 2. 피드 목록 쿼리들 낙관적 업데이트 수행
            previousQueries.forEach(([queryKey, oldData]: [any, any]) => {
                if (!oldData) return;

                queryClient.setQueryData(queryKey, (prev: any) =>
                    mapPostsInListData(prev, (item: any) => {
                            if (item.id !== postId) return item;
                            
                            const newReaction = type === item.userReaction ? null : type;
                            let newLikeCount = Number(item.likeCount || 0);
                            let newDislikeCount = Number(item.dislikeCount || 0);
                            
                            if (item.userReaction === 'like') newLikeCount--;
                            if (item.userReaction === 'dislike') newDislikeCount--;
                            
                            if (newReaction === 'like') newLikeCount++;
                            if (newReaction === 'dislike') newDislikeCount++;
                            
                            return {
                                ...item,
                                userReaction: newReaction,
                                likeCount: Math.max(0, newLikeCount),
                                dislikeCount: Math.max(0, newDislikeCount),
                            };
                    })
                );
            });

            return { previousPost, previousQueries };
        },
        onSuccess: (data) => {
            // 상세페이지 캐시 서버 최신값으로 업데이트
            queryClient.setQueryData<Post>(boardKeys.post(postId), (oldData) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    likeCount: data.likeCount,
                    dislikeCount: data.dislikeCount,
                    userReaction: data.userReaction,
                };
            });

            // 피드 목록 캐시들 서버 최신값으로 업데이트
            const postQueries = queryClient.getQueriesData({ queryKey: ['boards', 'posts'] });
            postQueries.forEach(([queryKey, oldData]: [any, any]) => {
                if (!oldData) return;

                queryClient.setQueryData(queryKey, (prev: any) =>
                    mapPostsInListData(prev, (item: any) => {
                        if (item.id !== postId) return item;
                        return {
                            ...item,
                            likeCount: data.likeCount,
                            dislikeCount: data.dislikeCount,
                            userReaction: data.userReaction,
                        };
                    })
                );
            });
        },
        onError: (err, type, context) => {
            // 실패 시 이전 상태로 복구
            if (context?.previousPost) {
                queryClient.setQueryData(boardKeys.post(postId), context.previousPost);
            }
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, oldData]) => {
                    queryClient.setQueryData(queryKey, oldData);
                });
            }
        },
    });
}

export function useToggleScrap(postId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => boardApi.toggleScrap(postId),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: boardKeys.post(postId) });
            const previousPost = queryClient.getQueryData<Post>(boardKeys.post(postId));

            if (previousPost) {
                queryClient.setQueryData<Post>(boardKeys.post(postId), (oldData) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        isScrapped: !oldData.isScrapped,
                    };
                });
            }

            return { previousPost };
        },
        onError: (err, _, context) => {
            if (context?.previousPost) {
                queryClient.setQueryData(boardKeys.post(postId), context.previousPost);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.post(postId) });
            queryClient.invalidateQueries({ queryKey: [...boardKeys.all, 'scrapped'] });
        },
    });
}

export function useMyScrappedPosts(page = 1, limit = 20) {
    return useQuery({
        queryKey: boardKeys.scrapped(page),
        queryFn: () => boardApi.getMyScrapped(page, limit),
    });
}
