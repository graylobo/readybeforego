import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CHAT_FONT_SIZE_MIN = 1;
export const CHAT_FONT_SIZE_MAX = 10;
export const CHAT_FONT_SIZE_DEFAULT = 3;

export interface ChatPrefs {
  fontSize: number;
  soundEnabled: boolean;
  membersOnly: boolean;
  profanityFilter: boolean;
  browserPush: boolean;
}

interface ChatPrefsState extends ChatPrefs {
  setFontSize: (fontSize: number) => void;
  setSoundEnabled: (soundEnabled: boolean) => void;
  setMembersOnly: (membersOnly: boolean) => void;
  setProfanityFilter: (profanityFilter: boolean) => void;
  setBrowserPush: (browserPush: boolean) => void;
}

function clampFontSize(value: number) {
  return Math.min(CHAT_FONT_SIZE_MAX, Math.max(CHAT_FONT_SIZE_MIN, Math.round(value)));
}

export function chatFontSizePx(fontSize: number) {
  return 11 + clampFontSize(fontSize);
}

export const useChatPrefsStore = create<ChatPrefsState>()(
  persist(
    (set) => ({
      fontSize: CHAT_FONT_SIZE_DEFAULT,
      soundEnabled: false,
      membersOnly: false,
      profanityFilter: true,
      browserPush: false,
      setFontSize: (fontSize) => set({ fontSize: clampFontSize(fontSize) }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setMembersOnly: (membersOnly) => set({ membersOnly }),
      setProfanityFilter: (profanityFilter) => set({ profanityFilter }),
      setBrowserPush: (browserPush) => set({ browserPush }),
    }),
    {
      name: 'community-chat-prefs',
    },
  ),
);
