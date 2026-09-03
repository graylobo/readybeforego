'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ChevronDown, MessageSquareText, Reply } from 'lucide-react';
import { formatChatReplyPreview, formatGuestTag, type ChatMessage } from '@community/shared-types';
import { maskProfanity } from '@/lib/chat/profanity';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { chatFontSizePx, useChatPrefsStore } from '@/lib/stores/chat-prefs.store';
import { useChatUiStore } from '@/lib/stores/chat-ui.store';
import { useChatFeature } from '@/components/chat/chat-feature-provider';
import { ChatLinkPreview } from './chat-link-preview';

function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<]+|(?:www\.)[^\s<]+|[a-zA-Z0-9-]+\.(?:com|net|org|kr|co\.kr|io|me|ai|app)\b[^\s<]*)/gi;
  const matches = text.match(urlRegex) || [];
  const result: string[] = [];

  for (const rawMatch of matches) {
    let match = rawMatch.replace(/[.,;!?)]+$/, '');
    if (!match.startsWith('http://') && !match.startsWith('https://')) {
      match = `https://${match}`;
    }
    try {
      const parsed = new URL(match);
      if (['http:', 'https:'].includes(parsed.protocol) && !result.includes(match)) {
        result.push(match);
      }
    } catch {
      // invalid URL
    }
  }

  return result;
}

const NICK_COLORS = [
  'text-emerald-500',
  'text-sky-500',
  'text-violet-500',
  'text-amber-500',
  'text-rose-500',
  'text-teal-500',
  'text-orange-500',
  'text-indigo-500',
];

function hashColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return NICK_COLORS[Math.abs(hash) % NICK_COLORS.length];
}

function authorColor(message: ChatMessage) {
  if (message.authorType === 'guest' && message.guestId) {
    return hashColor(message.guestId);
  }
  if (message.userId) {
    return hashColor(message.userId);
  }
  return hashColor(message.nickname);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatClock(date: Date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function formatChatTime(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return '방금';
  if (diffMs < 60 * 60_000) return `${Math.floor(diffMs / 60_000)}분 전`;

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const clock = formatClock(date);
  if (dayDiff === 0) return clock;
  if (dayDiff === 1) return `어제 ${clock}`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
  }
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${clock}`;
}

function isSelfMessage(
  message: ChatMessage,
  selfUserId: string | null,
  selfGuestId: string | null,
) {
  if (message.authorType === 'member' && selfUserId && message.userId === selfUserId) {
    return true;
  }
  if (message.authorType === 'guest' && selfGuestId && message.guestId === selfGuestId) {
    return true;
  }
  return false;
}

function messageDomId(id: string) {
  return `chat-msg-${id}`;
}

function isNearBottom(el: HTMLDivElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 48;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading?: boolean;
  blurred?: boolean;
  canReply?: boolean;
  selfUserId?: string | null;
  selfGuestId?: string | null;
}

export function ChatMessageList({
  messages,
  loading,
  blurred,
  canReply = false,
  selfUserId = null,
  selfGuestId = null,
}: ChatMessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const primedRef = useRef(false);
  const prevLenRef = useRef(0);
  const highlightTimer = useRef<number | null>(null);
  const [, setTick] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestUnread, setLatestUnread] = useState<ChatMessage | null>(null);
  const highlightedMessageId = useChatUiStore((state) => state.highlightedMessageId);
  const startReply = useChatUiStore((state) => state.startReply);
  const highlightMessage = useChatUiStore((state) => state.highlightMessage);
  const fontSize = useChatPrefsStore((state) => state.fontSize);
  const membersOnly = useChatPrefsStore((state) => state.membersOnly);
  const profanityFilter = useChatPrefsStore((state) => state.profanityFilter);
  const { showMessageTime } = useChatFeature();
  const visibleMessages = membersOnly
    ? messages.filter(
        (message) =>
          message.authorType === 'member' || isSelfMessage(message, selfUserId, selfGuestId),
      )
    : messages;
  const fontPx = chatFontSizePx(fontSize);

  const clearUnread = () => {
    setUnreadCount(0);
    setLatestUnread(null);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollerRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    clearUnread();
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    if (!showMessageTime) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(id);
  }, [showMessageTime]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = isNearBottom(el);
      stickToBottomRef.current = atBottom;
      if (atBottom) clearUnread();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    const nextLen = visibleMessages.length;

    if (nextLen === 0) {
      primedRef.current = false;
      prevLenRef.current = 0;
      clearUnread();
      return;
    }

    if (!primedRef.current) {
      primedRef.current = true;
      prevLenRef.current = nextLen;
      if (el) {
        stickToBottomRef.current = true;
        el.scrollTop = el.scrollHeight;
      }
      return;
    }

    if (nextLen <= prevLenRef.current) {
      prevLenRef.current = nextLen;
      return;
    }

    const added = nextLen - prevLenRef.current;
    const newest = visibleMessages[nextLen - 1];
    const mine = isSelfMessage(newest, selfUserId, selfGuestId);
    prevLenRef.current = nextLen;

    if (stickToBottomRef.current || mine) {
      if (el) el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = true;
      clearUnread();
      return;
    }

    setUnreadCount((count) => count + added);
    setLatestUnread(newest);
  }, [visibleMessages, selfUserId, selfGuestId]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  const jumpToMessage = (id: string) => {
    const node = document.getElementById(messageDomId(id));
    if (!node) return;
    stickToBottomRef.current = false;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightMessage(id);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => {
      highlightMessage(null);
      highlightTimer.current = null;
    }, 1600);
  };

  const empty = !loading && visibleMessages.length === 0;
  const unreadPreview = latestUnread
    ? formatChatReplyPreview(
        profanityFilter ? maskProfanity(latestUnread.content) : latestUnread.content,
      )
    : '';

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollerRef}
        style={{ fontSize: `${fontPx}px` }}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1',
          blurred && 'pointer-events-none select-none blur-[3px] opacity-60',
        )}
      >
        {loading && visibleMessages.length === 0 && (
          <div className="space-y-3 px-1 py-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        )}

        {empty && (
          <p className="text-center text-sm text-muted-foreground py-10">
            {membersOnly && messages.length > 0
              ? '표시할 고정닉 메시지가 없습니다.'
              : '아직 메시지가 없습니다.'}
            <br />
            {!(membersOnly && messages.length > 0) && '첫 메시지를 남겨보세요.'}
          </p>
        )}

        {visibleMessages.map((message) => {
          const mine = isSelfMessage(message, selfUserId, selfGuestId);
          const canReplyHere = canReply && !mine;
          const guestTag =
            message.authorType === 'guest' && message.guestId
              ? formatGuestTag(message.guestId)
              : null;
          const highlighted = highlightedMessageId === message.id;

          return (
            <article
              key={message.id}
              id={messageDomId(message.id)}
              className={cn(
                'relative leading-relaxed rounded-md px-2 py-1.5',
                canReplyHere && 'cursor-pointer hover:bg-muted/40',
                highlighted && 'chat-message-flash',
              )}
              onClick={() => {
                if (canReplyHere) startReply(message);
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className={cn('font-semibold truncate', authorColor(message))}>
                  {message.nickname}
                </span>
                {guestTag && (
                  <span className="text-[11px] text-muted-foreground/80 font-mono shrink-0">
                    {guestTag}
                  </span>
                )}
                {message.authorType === 'member' && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-label="회원" />
                )}
                {mine && (
                  <span className="shrink-0 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                    나
                  </span>
                )}
                {showMessageTime && (
                  <time className="text-[11px] text-muted-foreground shrink-0">
                    {formatChatTime(message.createdAt)}
                  </time>
                )}
              </div>

              {message.replyTo && (
                <button
                  type="button"
                  className="mt-1 mb-0.5 w-full flex items-center gap-1.5 min-w-0 text-left cursor-pointer hover:opacity-80"
                  title="원 메시지로 이동"
                  onClick={(event) => {
                    event.stopPropagation();
                    jumpToMessage(message.replyTo!.id);
                  }}
                >
                  <span className="w-0.5 h-4 rounded-full bg-emerald-400/80 shrink-0" />
                  <Reply className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="text-[12px] font-semibold text-emerald-500 truncate">
                    {message.replyTo.nickname}
                  </span>
                  <span className="text-[0.85em] text-muted-foreground truncate">
                    {formatChatReplyPreview(
                      profanityFilter
                        ? maskProfanity(message.replyTo.content)
                        : message.replyTo.content,
                    )}
                  </span>
                </button>
              )}

              {(() => {
                const textContent = profanityFilter ? maskProfanity(message.content) : message.content;
                const urls = extractUrls(message.content);
                const cleanText = textContent
                  .replace(
                    /(https?:\/\/[^\s<]+|(?:www\.)[^\s<]+|[a-zA-Z0-9-]+\.(?:com|net|org|kr|co\.kr|io|me|ai|app)\b[^\s<]*)/gi,
                    '',
                  )
                  .replace(/\s+/g, ' ')
                  .trim();

                return (
                  <>
                    {cleanText.length > 0 && (
                      <p className="text-foreground break-words whitespace-pre-wrap">
                        {cleanText}
                      </p>
                    )}
                    {urls.map((url) => (
                      <ChatLinkPreview key={url} url={url} />
                    ))}
                  </>
                );
              })()}
            </article>
          );
        })}
      </div>

      {unreadCount > 0 && latestUnread && !blurred && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className={cn(
            'absolute bottom-2 left-2 right-2 z-10',
            'flex items-center gap-2 rounded-xl border border-emerald-500/70 bg-card/95 px-3 py-2',
            'shadow-md backdrop-blur-sm cursor-pointer hover:bg-card',
          )}
        >
          <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="shrink-0 max-w-[40%] truncate text-xs font-semibold text-emerald-500">
            {latestUnread.nickname}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{unreadPreview}</span>
          <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
            +{unreadCount}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
