'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  CHAT_EVENTS,
  CHAT_LIMITS,
  CHAT_ROOM_DEFAULT,
  CHAT_SOCKET_NAMESPACE,
  ChatClientRole,
  ChatErrorPayload,
  ChatHistoryPayload,
  ChatJoinedPayload,
  ChatMessage,
  ChatOnlinePayload,
  ErrorCode,
} from '@community/shared-types';
import { API_URL } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';

const MAX_RENDERED_MESSAGES = CHAT_LIMITS.RECENT_CACHE_SIZE;

function trimMessages(messages: ChatMessage[]) {
  if (messages.length <= MAX_RENDERED_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_RENDERED_MESSAGES);
}

interface UseChatSocketOptions {
  enabled: boolean;
}

export function useChatSocket({ enabled }: UseChatSocketOptions) {
  const user = useAuthStore((state) => state.user);
  const guestToken = useChatGuestStore((state) => state.token);
  const clearGuest = useChatGuestStore((state) => state.clearGuest);

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

  const socketRef = useRef<Socket | null>(null);
  const guestTokenRef = useRef(guestToken);
  guestTokenRef.current = guestToken;
  const clearGuestRef = useRef(clearGuest);
  clearGuestRef.current = clearGuest;

  useEffect(() => {
    if (!enabled) return;

    const createSocket = () => {
      const token = guestTokenRef.current;
      return io(`${API_URL}${CHAT_SOCKET_NAMESPACE}`, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        auth: token ? { guestToken: token } : undefined,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
      });
    };

    const socket = createSocket();
    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit(CHAT_EVENTS.JOIN, { room: CHAT_ROOM_DEFAULT });
    };

    socket.on('connect', () => {
      setConnected(true);
      setUnavailable(false);
      joinRoom();
    });

    socket.on(CHAT_EVENTS.AVAILABLE, () => {
      joinRoom();
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setJoined(false);
      setUnavailable(true);
      setOnlineCount(0);
    });

    socket.on(CHAT_EVENTS.JOINED, (payload: ChatJoinedPayload) => {
      setJoined(true);
      setUnavailable(false);
      setError(null);
      setRole(payload.role);
      setNickname(payload.nickname);
      setOnlineCount(payload.onlineCount);
      setSelfUserId(payload.userId ?? null);
      setSelfGuestId(payload.guestId ?? null);

      if (guestTokenRef.current && payload.role === 'spectator') {
        clearGuestRef.current();
      }
    });

    socket.on(CHAT_EVENTS.HISTORY, (payload: ChatHistoryPayload) => {
      setMessages(trimMessages(payload.messages ?? []));
      setJoined(true);
    });

    socket.on(CHAT_EVENTS.MESSAGE, (message: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        return trimMessages([...prev, message]);
      });
    });

    socket.on(CHAT_EVENTS.ONLINE, (payload: ChatOnlinePayload) => {
      setOnlineCount(payload.count);
    });

    socket.on(CHAT_EVENTS.ERROR, (payload: ChatErrorPayload) => {
      if (payload.code === ErrorCode.CHAT_UNAVAILABLE) {
        setUnavailable(true);
        setJoined(false);
        setOnlineCount(0);
        setError(payload);
        return;
      }
      setError(payload);
      if (payload.code === ErrorCode.CHAT_NICKNAME_TAKEN) {
        clearGuestRef.current();
        setRole('spectator');
        setNickname(null);
        setSelfGuestId(null);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setJoined(false);
      setUnavailable(false);
      setSelfUserId(null);
      setSelfGuestId(null);
      setRole('spectator');
    };
  }, [enabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!enabled || !socket || !guestToken) return;
    const auth = socket.auth as { guestToken?: string } | undefined;
    if (auth?.guestToken === guestToken) return;
    socket.auth = { guestToken };
    if (socket.connected) {
      socket.disconnect();
      socket.connect();
    }
  }, [enabled, guestToken]);

  useEffect(() => {
    if (!enabled || connected || unavailable) return;
    const timeout = window.setTimeout(() => setUnavailable(true), 3000);
    return () => window.clearTimeout(timeout);
  }, [enabled, connected, unavailable]);

  useEffect(() => {
    if (!connected || joined) return;
    socketRef.current?.emit(CHAT_EVENTS.JOIN, { room: CHAT_ROOM_DEFAULT });
    const retry = window.setInterval(() => {
      socketRef.current?.emit(CHAT_EVENTS.JOIN, { room: CHAT_ROOM_DEFAULT });
    }, 2000);
    return () => window.clearInterval(retry);
  }, [connected, joined]);

  useEffect(() => {
    if (user) {
      setNickname(user.name);
      setSelfUserId(user.id);
      setSelfGuestId(null);
    }
  }, [user]);

  const sendMessage = useCallback((content: string, replyToId?: string) => {
    const trimmed = content.trim();
    if (!trimmed || !socketRef.current?.connected || unavailable) return false;
    setError(null);
    socketRef.current.emit(CHAT_EVENTS.SEND, {
      content: trimmed,
      room: CHAT_ROOM_DEFAULT,
      replyToId,
    });
    return true;
  }, [unavailable]);

  const canSend =
    connected &&
    joined &&
    !unavailable &&
    (Boolean(user) || Boolean(guestToken) || role === 'member' || role === 'guest');

  return {
    messages,
    onlineCount,
    role,
    nickname,
    selfUserId,
    selfGuestId,
    connected,
    joined,
    unavailable,
    error,
    canSend,
    sendMessage,
  };
}
