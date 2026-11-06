import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { API_URL } from '@/lib/api-client';
import { usePageVisible } from '@/hooks/use-page-visible';
import { useRealtimeConfig } from '@/hooks/queries/use-realtime-config';
import { getRealtimeClient } from '@/lib/realtime/client';
import { REALTIME_EVENTS } from '@community/shared-types';

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
  // 연결이 열려 있는 동안 API 서버(Cloud Run)가 계속 '요청 처리 중'으로 과금되므로, 탭이 보일 때만 연결한다.
  // 다시 보이면 새로 연결하면서 그 사이 쌓인 알림을 다시 받는다
  const pageVisible = usePageVisible();
  const { data: config, isError } = useRealtimeConfig();
  const provider = config?.provider ?? (isError ? 'server' : null);
  const connect = enabled && pageVisible && provider !== null;

  useEffect(() => {
    if (!connect) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

    // Supabase Realtime: 본인 알림 채널로 "새 알림" 신호만 받고, 내용은 로그인한 채로 다시 받아 온다 (API 서버는 연결을 들고 있지 않음)
    if (config?.provider === 'supabase') {
      let disposed = false;
      let release: (() => void) | null = null;
      Promise.all([notificationsApi.getRealtimeTopic(), getRealtimeClient(config)])
        .then(([topic, client]) => {
          if (disposed || !topic) return;
          const channel = client.channel(topic, { config: { private: true } });
          release = () => void client.removeChannel(channel);
          channel
            .on('broadcast', { event: REALTIME_EVENTS.NOTIFICATION }, refresh)
            .subscribe((status) => {
              // (재)연결될 때마다 끊겨 있던 동안 누락된 알림까지 한 번에 따라잡는다
              if (status === 'SUBSCRIBED') refresh();
            });
        })
        .catch(() => {
          // 실시간 알림을 못 받아도 알림 목록은 열 때 다시 받는다
        });
      return () => {
        disposed = true;
        release?.();
      };
    }

    const eventSource = new EventSource(`${API_URL}/notifications/sse`, { withCredentials: true });

    // (재)연결될 때마다 끊겨 있던 동안 누락된 알림까지 한 번에 따라잡는다.
    eventSource.onopen = refresh;
    eventSource.onmessage = refresh;

    // onerror에서 close()를 호출하면 브라우저 내장 자동 재연결이 영구 비활성화되어,
    // 서버 재시작/네트워크 순단 한 번만으로 세션 내내 실시간 알림이 죽는다.
    // 따라서 close하지 않고 브라우저가 알아서 재연결하도록 둔다.
    eventSource.onerror = () => {
      // no-op: EventSource가 자동으로 재연결을 시도한다.
    };

    return () => {
      eventSource.close();
    };
  }, [connect, config, queryClient]);
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
