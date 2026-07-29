import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boardApi, Post } from '@/lib/api/board';
export type { Post };

export const boardKeys = {
  all: ['boards'] as const,
  lists: () => [...boardKeys.all, 'list'] as const,
  detail: (slug: string) => [...boardKeys.all, 'detail', slug] as const,
  posts: (boardSlug: string, page: number = 1) => [...boardKeys.all, 'posts', boardSlug, { page }] as const,
  post: (id: string) => [...boardKeys.all, 'post', id] as const,
  scrapped: (page: number = 1) => [...boardKeys.all, 'scrapped', { page }] as const,
};

export function useBoards() {
  return useQuery({
    queryKey: boardKeys.lists(),
    queryFn: () => boardApi.getBoards(),
  });
}

export function useBoard(slug: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: boardKeys.detail(slug),
    queryFn: () => boardApi.getBoard(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 신선도 유지
    initialData: () => {
      const boards = queryClient.getQueryData<any[]>(boardKeys.lists());
      return boards?.find((b: any) => b.slug === slug);
    },
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
  includeBlocks?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...boardKeys.all, 'posts', boardSlug || 'all', { page, limit, searchType, searchQuery, authorId, isBest, isNotice, includeBlocks }],
    queryFn: () => boardApi.getPosts(boardSlug, page, limit, searchType, searchQuery, authorId, isBest, isNotice, includeBlocks),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30, // 30초간 신선도 유지하여 탭/페이지 전환 시 즉시 렌더링 ⚡
    placeholderData: (previousData: any) => previousData,
  });
}

export function usePost(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: boardKeys.post(id),
    queryFn: () => {
      // 캐시에 기존 데이터가 이미 존재한다면 (예: 좋아요/댓글 후 refetch), 조회수를 올리지 않음
      const existingData = queryClient.getQueryData(boardKeys.post(id));
      const shouldIncrement = !existingData;
      return boardApi.getPost(id, shouldIncrement);
    },
    enabled: !!id,
    // 게시글 상세의 경우 추천/댓글 등 부가 작업 시 다시 불러오지 않도록
    // staleTime을 적절히 주거나 수동 캐시 업데이트만 활용
    staleTime: 1000 * 60 * 5, 
  });
}

export function useCreatePost(boardSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => boardApi.createPost(boardSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.posts(boardSlug, 1) });
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
            queryClient.invalidateQueries({ queryKey: boardKeys.posts(boardSlug) });
        },
    });
}

export function useDeletePost(boardSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { id: string; guestPassword?: string }) => 
            boardApi.deletePost(data.id, data.guestPassword),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.posts(boardSlug) });
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
                if (!oldData || !oldData.items) return;
                
                queryClient.setQueryData(queryKey, (prev: any) => {
                    if (!prev || !prev.items) return prev;
                    return {
                        ...prev,
                        items: prev.items.map((item: any) => {
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
                    };
                });
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
                if (!oldData || !oldData.items) return;
                
                queryClient.setQueryData(queryKey, (prev: any) => {
                    if (!prev || !prev.items) return prev;
                    return {
                        ...prev,
                        items: prev.items.map((item: any) => {
                            if (item.id !== postId) return item;
                            return {
                                ...item,
                                likeCount: data.likeCount,
                                dislikeCount: data.dislikeCount,
                                userReaction: data.userReaction,
                            };
                        })
                    };
                });
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
