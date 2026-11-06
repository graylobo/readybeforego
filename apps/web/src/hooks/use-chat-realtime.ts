'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/realtime-js';
import {
  CHAT_LIMITS,
  CHAT_ROOM_DEFAULT,
  ChatClientRole,
  ChatErrorPayload,
  ChatMessage,
  ErrorCode,
  ErrorMessages,
  REALTIME_EVENTS,
} from '@community/shared-types';
import type { RealtimeConfig } from '@community/shared-types';
import { chatApi } from '@/lib/api/chat';
import { getRealtimeClient } from '@/lib/realtime/client';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';

const MAX_RENDERED_MESSAGES = CHAT_LIMITS.RECENT_CACHE_SIZE;
// 서버가 잠시 채팅을 받을 수 없을 때(Redis 장애 등) 다시 확인하는 간격
const UNAVAILABLE_RETRY_MS = 10_000;

function trimMessages(messages: ChatMessage[]) {
  if (messages.length <= MAX_RENDERED_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_RENDERED_MESSAGES);
}

/** 최근 기록과 그 사이 도착한 메시지를 합친다 (같은 메시지는 하나만, 시간순) */
function mergeMessages(history: ChatMessage[], live: ChatMessage[]) {
  const byId = new Map(history.map((message) => [message.id, message]));
  for (const message of live) byId.set(message.id, message);
  return trimMessages([...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}

function toChatError(error: unknown): ChatErrorPayload {
  const data = (error as { response?: { data?: { errorCode?: ErrorCode; message?: unknown } } })?.response?.data;
  const code = data?.errorCode ?? ErrorCode.INTERNAL_SERVER_ERROR;
  const message = typeof data?.message === 'string' && /[가-힣]/.test(data.message) ? data.message : ErrorMessages[code];
  return { code, message: message ?? '요청 처리 중 오류가 발생했습니다.' };
}

interface UseChatRealtimeOptions {
  enabled: boolean;
  config: Extract<RealtimeConfig, { provider: 'supabase' }> | null;
}

/**
 * Supabase Realtime으로 하는 채팅. 웹소켓 채팅(useChatSocket)과 같은 값을 돌려준다.
 * 받기(메시지·삭제·접속자 수)는 Supabase 채널로, 보내기·지우기·내 역할 확인은 API 요청으로 한다.
 * 그래서 API 서버는 누가 보낼 때만 잠깐 일하고, 채팅 창을 켜 둔 시간 동안 과금되지 않는다
 */
export function useChatRealtime({ enabled, config }: UseChatRealtimeOptions) {
  const user = useAuthStore((state) => state.user);
  const guestToken = useChatGuestStore((state) => state.token);
  const clearGuest = useChatGuestStore((state) => state.clearGuest);
  const room = CHAT_ROOM_DEFAULT;
  const active = enabled && !!config;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [role, setRole] = useState<ChatClientRole>('spectator');
  const [nickname, setNickname] = useState<string | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [selfGuestId, setSelfGuestId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<ChatErrorPayload | null>(null);
  // 채널에 (다시) 연결될 때마다 늘려, 끊겨 있던 동안의 메시지를 최근 기록으로 다시 받게 한다
  const [syncRound, setSyncRound] = useState(0);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : trimMessages([...prev, message])));
  }, []);

  // 1. 채팅방 채널 구독 (받기 전용 비공개 채널, 접속자 표시)
  useEffect(() => {
    if (!active || !config) return;
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let release: (() => void) | null = null;

    getRealtimeClient(config)
      .then((client) => {
        if (disposed) return;
        const ch = client.channel(`chat:${room}`, {
          config: { private: true, presence: { key: crypto.randomUUID() } },
        });
        channel = ch;
        release = () => void client.removeChannel(ch);
        ch.on('broadcast', { event: REALTIME_EVENTS.CHAT_MESSAGE }, ({ payload }) => addMessage(payload as ChatMessage))
          .on('broadcast', { event: REALTIME_EVENTS.CHAT_MESSAGE_DELETED }, ({ payload }) => {
            const id = (payload as { id?: string })?.id;
            if (id) setMessages((prev) => prev.filter((item) => item.id !== id));
          })
          .on('broadcast', { event: REALTIME_EVENTS.CHAT_HISTORY_CLEARED }, () => setMessages([]))
          .on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(ch.presenceState()).length))
          .subscribe((status) => {
            if (disposed) return;
            if (status === 'SUBSCRIBED') {
              setConnected(true);
              void ch.track({});
              setSyncRound((round) => round + 1);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setConnected(false);
              setUnavailable(true);
            } else if (status === 'CLOSED') {
              setConnected(false);
            }
          });
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });

    return () => {
      disposed = true;
      if (channel) release?.();
      setConnected(false);
      setJoined(false);
      setUnavailable(false);
      setOnlineCount(0);
      setSelfUserId(null);
      setSelfGuestId(null);
      setRole('spectator');
    };
  }, [active, config, room, addMessage]);

  // 2. 연결될 때마다(그리고 비회원 닉네임을 정하면) 내 역할과 최근 기록을 받는다
  useEffect(() => {
    if (!active || !connected) return;
    let cancelled = false;
    Promise.all([chatApi.getSession(guestToken), chatApi.getMessages(room)])
      .then(([session, history]) => {
        if (cancelled) return;
        setRole(session.role);
        setNickname(session.nickname);
        setSelfUserId(session.userId);
        setSelfGuestId(session.guestId);
        // 비회원 토큰이 만료됐거나 맞지 않으면 구경 모드라 다시 닉네임을 정하게 한다
        if (guestToken && session.role === 'spectator') clearGuest();
        setMessages((prev) => mergeMessages(history, prev));
        setJoined(true);
        setUnavailable(false);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const payload = toChatError(err);
        if (payload.code === ErrorCode.CHAT_UNAVAILABLE) setUnavailable(true);
        setError(payload);
      });
    return () => {
      cancelled = true;
    };
  }, [active, connected, syncRound, guestToken, room, clearGuest]);

  // 서버가 잠시 채팅을 받을 수 없으면 조금 뒤 다시 확인한다
  useEffect(() => {
    if (!active || !connected || !unavailable) return;
    const timer = window.setTimeout(() => setSyncRound((round) => round + 1), UNAVAILABLE_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [active, connected, unavailable]);

  const handleError = useCallback(
    (err: unknown) => {
      const payload = toChatError(err);
      if (payload.code === ErrorCode.CHAT_UNAVAILABLE) setUnavailable(true);
      if (payload.code === ErrorCode.CHAT_NICKNAME_TAKEN) {
        clearGuest();
        setRole('spectator');
        setNickname(null);
        setSelfGuestId(null);
      }
      setError(payload);
    },
    [clearGuest],
  );

  const sendMessage = useCallback(
    (content: string, replyToId?: string) => {
      const trimmed = content.trim();
      if (!trimmed || !connected || unavailable) return false;
      setError(null);
      chatApi
        .sendMessage({ content: trimmed, replyToId, room }, guestToken)
        .then(addMessage)
        .catch(handleError);
      return true;
    },
    [connected, unavailable, room, guestToken, addMessage, handleError],
  );

  const deleteMessage = useCallback(
    (id: string) => {
      if (!id || !connected || unavailable) return false;
      setError(null);
      chatApi
        .deleteMessage(id, room, guestToken)
        .then(() => setMessages((prev) => prev.filter((item) => item.id !== id)))
        .catch(handleError);
      return true;
    },
    [connected, unavailable, room, guestToken, handleError],
  );

  const canSend =
    connected &&
    joined &&
    !unavailable &&
    (Boolean(user) || Boolean(guestToken) || role === 'member' || role === 'guest');

  return {
    messages,
    onlineCount,
    role,
    // 로그인한 회원은 입장 정보를 받기 전에도 내 이름·내 메시지 표시를 할 수 있게 로그인 정보를 먼저 쓴다
    nickname: user ? user.name : nickname,
    selfUserId: user ? user.id : selfUserId,
    selfGuestId: user ? null : selfGuestId,
    connected,
    joined,
    unavailable,
    error,
    canSend,
    sendMessage,
    deleteMessage,
  };
}
