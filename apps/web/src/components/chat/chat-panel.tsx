'use client';

import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Settings, SquareArrowOutUpRight, X } from 'lucide-react';
import { ErrorCode, ErrorMessages, formatGuestTag } from '@community/shared-types';
import { Button } from '@/components/ui/button';
import { useChatAlerts } from '@/hooks/use-chat-alerts';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { useIsLgUp } from '@/hooks/use-media-query';
import { openChatPopup } from '@/lib/chat/popup';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';
import { useChatUiStore } from '@/lib/stores/chat-ui.store';
import { cn } from '@/lib/utils/cn';
import { ChatComposer } from './chat-composer';
import { ChatGuestGate } from './chat-guest-gate';
import { ChatMessageList } from './chat-message-list';
import { ChatOnlineCount } from './chat-online-count';
import { ChatSettingsPanel } from './chat-settings-panel';
import { ChatUnavailable } from './chat-unavailable';
import { useChatFeature } from './chat-feature-provider';

interface ChatPanelProps {
  variant?: 'rail' | 'popup';
}

export function ChatPanel({ variant = 'rail' }: ChatPanelProps) {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useChatGuestStore((state) => state.hasHydrated);
  const guestToken = useChatGuestStore((state) => state.token);
  const setHasHydrated = useChatGuestStore((state) => state.setHasHydrated);
  const isDesktop = useIsLgUp();
  const mobileMode = useChatUiStore((state) => state.mobileMode);
  const railOpen = useChatUiStore((state) => state.railOpen);
  const expand = useChatUiStore((state) => state.expand);
  const shrink = useChatUiStore((state) => state.shrink);
  const close = useChatUiStore((state) => state.close);
  const replyTo = useChatUiStore((state) => state.replyTo);
  const clearReply = useChatUiStore((state) => state.clearReply);
  const { showOnlineCount } = useChatFeature();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (useChatGuestStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }
    const unsub = useChatGuestStore.persist.onFinishHydration(() => setHasHydrated(true));
    const timeout = window.setTimeout(() => setHasHydrated(true), 50);
    return () => {
      unsub();
      window.clearTimeout(timeout);
    };
  }, [setHasHydrated]);

  useEffect(() => {
    if (mobileMode === 'closed') return;
    const media = window.matchMedia('(min-width: 1024px)');
    if (media.matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMode]);

  const {
    messages,
    onlineCount,
    nickname,
    selfUserId,
    selfGuestId,
    connected,
    joined,
    unavailable,
    error,
    canSend,
    sendMessage,
  } = useChatSocket({ enabled: true });

  useChatAlerts(messages, joined, nickname, selfUserId, selfGuestId);

  const isPopup = variant === 'popup';
  const showGate = hasHydrated && !unavailable && !user && !guestToken;
  const headerNick =
    nickname && selfGuestId ? `${nickname} ${formatGuestTag(selfGuestId)}` : nickname;
  const mobileOpen = !isPopup && !isDesktop && mobileMode !== 'closed';
  const mobileFull = !isPopup && !isDesktop && mobileMode === 'full';
  const railVisible = !isPopup && isDesktop && railOpen;
  const panelVisible = isPopup || mobileOpen || railVisible;

  useEffect(() => {
    if (!isDesktop || mobileMode === 'closed') return;
    useChatUiStore.setState({ mobileMode: 'closed', railOpen: true });
  }, [isDesktop, mobileMode]);

  const handleOpenPopup = () => {
    openChatPopup();
    if (mobileOpen || railOpen) close();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[99] bg-black/40 lg:hidden cursor-pointer"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'flex-col bg-card min-h-0',
          isPopup && 'flex h-dvh w-full',
          !isPopup &&
            railVisible &&
            'lg:relative lg:flex lg:self-start lg:h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4rem)] lg:w-[320px] xl:w-[360px] lg:shrink-0 lg:overflow-hidden lg:border-l lg:border-border lg:rounded-none lg:shadow-none',
          !isPopup && !panelVisible && 'hidden',
          !isPopup &&
            mobileOpen &&
            'fixed z-[100] flex shadow-2xl lg:static lg:z-auto lg:h-full lg:max-h-none lg:inset-auto lg:rounded-none lg:border-t-0 lg:shadow-none',
          !isPopup &&
            mobileOpen &&
            !mobileFull &&
            'inset-x-0 bottom-0 h-[58dvh] max-h-[70dvh] rounded-t-2xl border-t border-border',
          !isPopup && mobileOpen && mobileFull && 'inset-0 h-dvh rounded-none border-0 lg:h-full',
        )}
        aria-label="실시간 채팅"
      >
        {mobileOpen && !mobileFull && (
          <div className="lg:hidden flex justify-center pt-2 pb-0 shrink-0" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        <header className="h-12 shrink-0 px-3 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className={cn('text-sm font-semibold truncate', !isPopup && 'lg:hidden')}>
              실시간 채팅
            </h2>
            {unavailable ? (
              <span
                className={cn(
                  'text-sm font-medium text-muted-foreground',
                  !isPopup && 'hidden lg:inline',
                )}
              >
                채팅 중단
              </span>
            ) : (
              showOnlineCount && (
                <ChatOnlineCount
                  count={onlineCount}
                  live={connected}
                  className={cn(!isPopup && 'hidden lg:inline-flex')}
                />
              )
            )}
          </div>
          <div className="flex items-center gap-0.5 min-w-0">
            {headerNick && (
              <span
                className={cn(
                  'text-xs text-muted-foreground truncate max-w-[140px] mr-1',
                  !isPopup && 'hidden lg:inline',
                )}
              >
                {headerNick}
              </span>
            )}
            {!unavailable && showOnlineCount && !isPopup && (
              <ChatOnlineCount
                count={onlineCount}
                live={connected}
                className="lg:hidden mr-1"
              />
            )}
            {mobileOpen && !mobileFull && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 px-2 gap-1 text-xs"
                onClick={expand}
              >
                <Maximize2 className="h-3.5 w-3.5" />
                전체
              </Button>
            )}
            {mobileFull && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 px-2 gap-1 text-xs"
                onClick={shrink}
              >
                <Minimize2 className="h-3.5 w-3.5" />
                축소
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="채팅 설정"
              aria-pressed={settingsOpen}
            >
              <Settings className="h-4 w-4" />
            </Button>
            {!isPopup && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1 text-xs cursor-pointer"
                onClick={handleOpenPopup}
              >
                <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                팝업
              </Button>
            )}
            {isPopup ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => window.close()}
                aria-label="팝업 닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={close}
                aria-label="채팅 닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        <div className="relative flex-1 flex flex-col min-h-0">
          <ChatMessageList
            messages={unavailable ? [] : messages}
            loading={!unavailable && !joined}
            blurred={showGate}
            canReply={canSend}
            selfUserId={selfUserId}
            selfGuestId={selfGuestId}
          />
          {unavailable && <ChatUnavailable />}
          {showGate && <ChatGuestGate />}
          {!unavailable && !showGate && (
            <div className={cn(mobileOpen && 'pb-[env(safe-area-inset-bottom)] lg:pb-0')}>
              <ChatComposer
                disabled={!canSend}
                replyTo={replyTo}
                onCancelReply={clearReply}
                onSend={(content, replyToId) => {
                  const sent = sendMessage(content, replyToId);
                  if (sent) clearReply();
                  return sent;
                }}
              />
            </div>
          )}
          {error && error.code !== ErrorCode.CHAT_NICKNAME_TAKEN && error.code !== ErrorCode.CHAT_UNAVAILABLE && (
            <p className="px-3 pb-2 text-xs text-destructive shrink-0">
              {ErrorMessages[error.code as ErrorCode] || error.message}
            </p>
          )}
          {settingsOpen && <ChatSettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
      </aside>
    </>
  );
}
