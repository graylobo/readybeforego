'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useChatSettings } from '@/hooks/queries/use-chat-queries';
import { registerChatAuthBridge } from '@/lib/chat/auth-bridge';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';
import { useChatUiStore } from '@/lib/stores/chat-ui.store';

interface ChatFeatureValue {
  enabled: boolean;
  ready: boolean;
  showOnlineCount: boolean;
  showMessageTime: boolean;
  defaultOpen: boolean;
}

const ChatFeatureContext = createContext<ChatFeatureValue>({
  enabled: false,
  ready: true,
  showOnlineCount: false,
  showMessageTime: false,
  defaultOpen: true,
});

export function useChatFeature() {
  return useContext(ChatFeatureContext);
}

export function ChatFeatureProvider({ children }: { children: ReactNode }) {
  const setHasHydrated = useChatGuestStore((state) => state.setHasHydrated);
  const { data, isError, isLoading } = useChatSettings();
  const initializedRef = useRef(false);

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

  useEffect(() => {
    if (data && !initializedRef.current) {
      initializedRef.current = true;
      const userOverride = useChatUiStore.getState().userOverride;
      const effectiveRailOpen = userOverride !== null ? userOverride : data.defaultOpen;
      useChatUiStore.setState({ railOpen: effectiveRailOpen });
    }
  }, [data]);

  const enabled = !isError && (data?.enabled ?? false);
  const ready = !isLoading;
  const showOnlineCount = enabled && (data?.showOnlineCount ?? false);
  const showMessageTime = enabled && (data?.showMessageTime ?? false);
  const defaultOpen = enabled && (data?.defaultOpen ?? true);

  return (
    <ChatFeatureContext.Provider value={{ enabled, ready, showOnlineCount, showMessageTime, defaultOpen }}>
      {children}
    </ChatFeatureContext.Provider>
  );
}
