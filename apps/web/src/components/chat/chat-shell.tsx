'use client';

import type { ReactNode } from 'react';
import { ChatGuestMenu } from '@/components/chat/chat-guest-menu';
import { ChatGuestProfileView } from '@/components/chat/chat-guest-profile';
import dynamic from 'next/dynamic';
import { useChatFeature } from '@/components/chat/chat-feature-provider';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';

// 채팅 패널(socket.io 포함)과 버튼은 채팅이 켜져 있을 때만 보이므로, 그때 받는다.
// 정적으로 import하면 채팅을 끈 사이트에서도 모든 페이지가 socket.io 등을 받아 실행한다.
const ChatFab = dynamic(() => import('@/components/chat/chat-fab').then((m) => m.ChatFab), { ssr: false });
const ChatPanel = dynamic(() => import('@/components/chat/chat-panel').then((m) => m.ChatPanel), { ssr: false });

export function ChatShell() {
  const { enabled } = useChatFeature();
  if (!enabled) return null;
  return (
    <>
      <ChatFab />
      <ChatPanel />
    </>
  );
}

export function ChatGuestIdentity({ fallback }: { fallback: ReactNode }) {
  const { enabled } = useChatFeature();
  const nickname = useChatGuestStore((state) => state.nickname);
  const hydrated = useChatGuestStore((state) => state.hasHydrated);

  if (!enabled) return fallback;
  if (hydrated && nickname) return <ChatGuestMenu />;
  return fallback;
}

export function ChatGuestProfileGate({ fallback }: { fallback: ReactNode }) {
  const { enabled, ready } = useChatFeature();
  const nickname = useChatGuestStore((state) => state.nickname);
  const hydrated = useChatGuestStore((state) => state.hasHydrated);

  if (!enabled) return fallback;
  if (!ready || !hydrated) return null;
  if (nickname) return <ChatGuestProfileView />;
  return fallback;
}
