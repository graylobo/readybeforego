import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { pointsApi } from '@/lib/api/points';

export const adminKeys = {
  stats: ['admin', 'stats'] as const,
  users: {
    all: ['admin', 'users'] as const,
    list: (search?: string) => ['admin', 'users', { search }] as const,
  },
  moderationLogs: (userId: string) => ['admin', 'users', userId, 'moderation-logs'] as const,
  boards: ['admin', 'boards'] as const,
  pointPolicies: ['admin', 'points', 'policies'] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: () => adminApi.getDashboard(),
  });
}

export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: adminKeys.users.list(search),
    queryFn: () => adminApi.getUsers(search),
  });
}

export function useUserModerationLogs(userId: string) {
  return useQuery({
    queryKey: adminKeys.moderationLogs(userId),
    queryFn: () => adminApi.getModerationLogs(userId),
    enabled: !!userId,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: any }) => adminApi.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users.all });
    },
  });
}

export function useWarnUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.warnUser(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users.all });
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, days }: { id: string; reason: string; days: number }) => adminApi.suspendUser(id, reason, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users.all });
    },
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.banUser(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users.all });
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.reactivateUser(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users.all });
    },
  });
}

export function useAdminBoards() {
  return useQuery({
    queryKey: adminKeys.boards,
    queryFn: () => adminApi.getBoards(),
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApi.createBoard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.boards });
      queryClient.invalidateQueries({ queryKey: ['boards'] }); // Global board list
    },
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateBoard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.boards });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteBoard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.boards });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useAdminPointPolicies() {
  return useQuery({
    queryKey: adminKeys.pointPolicies,
    queryFn: () => adminApi.getPointPolicies(),
  });
}

export function useUpdatePointPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updatePointPolicy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pointPolicies });
    },
  });
}


export const pointKeys = {
  all: ['points'] as const,
  me: () => [...pointKeys.all, 'me'] as const,
  history: () => [...pointKeys.all, 'history'] as const,
};

export function useMyPoints() {
  return useQuery({
    queryKey: pointKeys.me(),
    queryFn: () => pointsApi.getMyPoints(),
  });
}

export function usePointHistory() {
  return useQuery({
    queryKey: pointKeys.history(),
    queryFn: () => pointsApi.getHistory(),
  });
}
