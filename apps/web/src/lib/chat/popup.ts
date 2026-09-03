export const CHAT_POPUP_PATH = '/chat-popup';
export const CHAT_POPUP_NAME = 'community-chat-popup';

const POPUP_WIDTH = 400;
const POPUP_HEIGHT = 720;

export function openChatPopup() {
  if (typeof window === 'undefined') return null;

  const left = Math.max(0, window.screenX + window.outerWidth - POPUP_WIDTH - 24);
  const top = Math.max(0, window.screenY + 72);
  const features = [
    'popup=yes',
    `width=${POPUP_WIDTH}`,
    `height=${POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  const popup = window.open(CHAT_POPUP_PATH, CHAT_POPUP_NAME, features);
  popup?.focus();
  return popup;
}
