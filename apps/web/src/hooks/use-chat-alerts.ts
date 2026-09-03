import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@community/shared-types';
import { notifyChatAlert } from '@/lib/chat/alerts';

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

export function useChatAlerts(
  messages: ChatMessage[],
  joined: boolean,
  nickname: string | null,
  selfUserId: string | null,
  selfGuestId: string | null,
) {
  const seenIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!joined) {
      primed.current = false;
      seenIds.current.clear();
      return;
    }

    const myMessageIds = new Set(
      messages
        .filter((message) => isSelfMessage(message, selfUserId, selfGuestId))
        .map((message) => message.id),
    );

    if (!primed.current) {
      for (const message of messages) {
        seenIds.current.add(message.id);
      }
      primed.current = true;
      return;
    }

    for (const message of messages) {
      if (seenIds.current.has(message.id)) continue;
      seenIds.current.add(message.id);
      if (isSelfMessage(message, selfUserId, selfGuestId)) continue;
      notifyChatAlert(message, myMessageIds, nickname);
    }
  }, [joined, messages, nickname, selfGuestId, selfUserId]);
}
