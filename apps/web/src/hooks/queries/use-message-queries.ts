import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/lib/api/messages';
import { SendMessageDto } from '@community/shared-types';
import { useAuthStore } from '@/lib/stores/auth.store';

export const messageKeys = {
  all: ['messages'] as const,
  received: (page: number) => [...messageKeys.all, 'received', page] as const,
  sent: (page: number) => [...messageKeys.all, 'sent', page] as const,
  detail: (id: string) => [...messageKeys.all, 'detail', id] as const,
  unreadCount: ['messages', 'unreadCount'] as const,
};

export function useReceivedMessages(page: number = 1) {
  return useQuery({
    queryKey: messageKeys.received(page),
    queryFn: () => messagesApi.getReceivedMessages(page),
  });
}

export function useSentMessages(page: number = 1) {
  return useQuery({
    queryKey: messageKeys.sent(page),
    queryFn: () => messagesApi.getSentMessages(page),
  });
}

export function useMessageDetail(id: string | null) {
  return useQuery({
    queryKey: messageKeys.detail(id || ''),
    queryFn: () => messagesApi.getMessage(id!),
    enabled: !!id,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SendMessageDto) => messagesApi.sendMessage(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesApi.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

export function useUnreadMessageCount() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: messageKeys.unreadCount,
    queryFn: () => messagesApi.getUnreadCount(),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지 (실시간 알림 이벤트 또는 액션 시 자동 invalidate)
  });
}
