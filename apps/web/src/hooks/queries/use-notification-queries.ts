import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { API_URL } from '@/lib/api-client';

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.findAll,
  });
};

export const useUnreadNotificationCount = (options: { enabled?: boolean } = {}) => {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    ...options,
  });
};

export const useNotificationSSE = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const eventSource = new EventSource(`${API_URL}/notifications/sse`, { withCredentials: true });

    // (재)연결될 때마다 끊겨 있던 동안 누락된 알림까지 한 번에 따라잡는다.
    eventSource.onopen = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    eventSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    // onerror에서 close()를 호출하면 브라우저 내장 자동 재연결이 영구 비활성화되어,
    // 서버 재시작/네트워크 순단 한 번만으로 세션 내내 실시간 알림이 죽는다.
    // 따라서 close하지 않고 브라우저가 알아서 재연결하도록 둔다.
    eventSource.onerror = () => {
      // no-op: EventSource가 자동으로 재연결을 시도한다.
    };

    return () => {
      eventSource.close();
    };
  }, [enabled, queryClient]);
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useRemoveNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useRemoveAllNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.removeAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
