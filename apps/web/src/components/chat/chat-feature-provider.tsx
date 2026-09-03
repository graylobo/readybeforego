'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useChatSettings } from '@/hooks/queries/use-chat-queries';
import { registerChatAuthBridge } from '@/lib/chat/auth-bridge';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';

interface ChatFeatureValue {
  enabled: boolean;
  ready: boolean;
  showOnlineCount: boolean;
  showMessageTime: boolean;
}

const ChatFeatureContext = createContext<ChatFeatureValue>({
  enabled: false,
  ready: true,
  showOnlineCount: false,
  showMessageTime: false,
});

export function useChatFeature() {
  return useContext(ChatFeatureContext);
}

export function ChatFeatureProvider({ children }: { children: ReactNode }) {
  const setHasHydrated = useChatGuestStore((state) => state.setHasHydrated);
  const { data, isError, isLoading } = useChatSettings();

  useEffect(() => {
    registerChatAuthBridge();
  }, []);

  useEffect(() => {
    if (useChatGuestStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }
    return useChatGuestStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, [setHasHydrated]);

  const enabled = !isError && (data?.enabled ?? false);
  const ready = !isLoading;
  const showOnlineCount = enabled && (data?.showOnlineCount ?? false);
  const showMessageTime = enabled && (data?.showMessageTime ?? false);

  return (
    <ChatFeatureContext.Provider value={{ enabled, ready, showOnlineCount, showMessageTime }}>
      {children}
    </ChatFeatureContext.Provider>
  );
}
