import { onAuthIdentityChange } from '@/lib/stores/auth.events';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';

let unsubscribe: (() => void) | null = null;

export function registerChatAuthBridge(): void {
  if (unsubscribe) return;
  unsubscribe = onAuthIdentityChange((authenticated) => {
    if (authenticated) {
      useChatGuestStore.getState().clearGuest();
    }
  });
}
