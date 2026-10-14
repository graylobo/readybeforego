import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAdmin } from '@community/shared-types';
import { boardCommunityApi } from '@/lib/api/board-community';
import { useAuthStore } from '@/lib/stores/auth.store';
import { boardKeys } from './use-board-queries';

export const boardCommunityKeys = {
  all: ['board-community'] as const,
  directory: (q: string) => [...boardCommunityKeys.all, 'directory', q] as const,
  myRequests: () => [...boardCommunityKeys.all, 'my-requests'] as const,
  requests: (status: string, page: number) => [...boardCommunityKeys.all, 'requests', status, page] as const,
  managers: (slug: string) => [...boardCommunityKeys.all, 'managers', slug] as const,
};

export function useBoardDirectory(q: string) {
  return useQuery({
    queryKey: boardCommunityKeys.directory(q),
    queryFn: () => boardCommunityApi.getDirectory(q),
    staleTime: 30_000,
  });
}

export function useMyBoardRequests(enabled: boolean) {
  return useQuery({
    queryKey: boardCommunityKeys.myRequests(),
    queryFn: () => boardCommunityApi.getMyRequests(),
    enabled,
  });
}

export function useCreateBoardRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: boardCommunityApi.createRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardCommunityKeys.myRequests() }),
  });
}

export function useBoardManagers(slug: string, enabled = true) {
  return useQuery({
    queryKey: boardCommunityKeys.managers(slug),
    queryFn: () => boardCommunityApi.getManagers(slug),
    enabled: enabled && !!slug && slug !== 'all' && slug !== 'best',
    staleTime: 30_000,
  });
}

/**
 * 지금 사용자가 이 게시판에서 할 수 있는 관리: 글/댓글 삭제·공지(게시판 관리자 또는 사이트 관리자),
 * 부매니저 지정·설명 수정(매니저 또는 사이트 관리자)
 */
export function useBoardPermissions(slug: string) {
  const { user } = useAuthStore();
  // 매니저 이름은 비회원에게도 보여주므로 로그인 여부와 상관없이 받는다
  const { data: managers = [] } = useBoardManagers(slug);
  const siteAdmin = isAdmin(user?.role);
  const myRole = user ? managers.find((m) => m.userId === user.id)?.role : undefined;
  return {
    managers,
    canModerate: siteAdmin || !!myRole,
    canManage: siteAdmin || myRole === 'manager',
  };
}

export function useAddSubManager(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => boardCommunityApi.addSubManager(slug, name),
    onSuccess: (managers) => queryClient.setQueryData(boardCommunityKeys.managers(slug), managers),
  });
}

export function useRemoveSubManager(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => boardCommunityApi.removeSubManager(slug, userId),
    onSuccess: (managers) => queryClient.setQueryData(boardCommunityKeys.managers(slug), managers),
  });
}

export function useUpdateBoardSettings(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: { description?: string; showManagers?: boolean }) => boardCommunityApi.updateSettings(slug, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(slug) });
      queryClient.invalidateQueries({ queryKey: boardCommunityKeys.all });
    },
  });
}

export function useBoardRequests(status: string, page: number) {
  return useQuery({
    queryKey: boardCommunityKeys.requests(status, page),
    queryFn: () => boardCommunityApi.getRequests(status === 'all' ? undefined : status, page),
  });
}

export function useReviewBoardRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }) =>
      boardCommunityApi.reviewRequest(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardCommunityKeys.all });
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}
