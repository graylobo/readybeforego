'use client';

import type { ReactNode } from 'react';
import { ChatGuestMenu } from '@/components/chat/chat-guest-menu';
import { ChatGuestProfileView } from '@/components/chat/chat-guest-profile';
import { ChatFab } from '@/components/chat/chat-fab';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useChatFeature } from '@/components/chat/chat-feature-provider';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';

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
