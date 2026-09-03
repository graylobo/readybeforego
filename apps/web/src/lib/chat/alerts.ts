import type { ChatMessage } from "@community/shared-types";
import { SITE_CONFIG } from "@/lib/constants";
import { maskProfanity } from "@/lib/chat/profanity";
import { useChatPrefsStore } from "@/lib/stores/chat-prefs.store";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isChatMention(
  content: string,
  nickname: string | null | undefined,
) {
  if (!nickname) return false;
  return new RegExp(
    `(?:^|\\s)@${escapeRegExp(nickname)}(?=$|\\s|[.,!?])`,
    "i",
  ).test(content);
}

export function isReplyToMe(message: ChatMessage, myMessageIds: Set<string>) {
  return Boolean(message.replyTo?.id && myMessageIds.has(message.replyTo.id));
}

/**
 * 채팅 알림음 (Web Audio로 합성).
 *
 * 벨/톡/짧은 알림으로 바꾸려면 아래 PRESET만 바꾸면 된다.
 * - 'short' : 지금 기본값. 짧은 비프 1회
 * - 'bell'  : 조금 낮은 음 + 길게 감쇠 (종 느낌)
 * - 'talk'  : 짧은 비프 2회 (톡톡)
 *
 * 나중에 설정 UI에서 고르게 하려면 chat-prefs.store에 soundPreset을 두고
 * playChatAlertSound(prefs.soundPreset)처럼 넘기면 된다.
 * mp3/wav 파일을 쓰려면 new Audio('/sounds/chat-bell.mp3').play()로 바꾸면 된다.
 */
type ChatAlertSoundPreset = "short" | "bell" | "talk";

export function playChatAlertSound(preset: ChatAlertSoundPreset = "talk") {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  const beep = (
    at: number,
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
  ) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  };

  const now = ctx.currentTime;
  // PRESET: 'short' | 'bell' | 'talk' 로 교체
  if (preset === "bell") {
    beep(now, 660, 0.35, "triangle");
  } else if (preset === "talk") {
    beep(now, 980, 0.08);
    beep(now + 0.12, 980, 0.08);
  } else {
    beep(now, 880, 0.18);
  }

  window.setTimeout(() => {
    void ctx.close();
  }, 500);
}

export async function requestChatPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window))
    return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** 다른 창/모니터에 가려진 경우에도 포커스가 없으면 푸시를 보낸다. */
function shouldShowBrowserPush() {
  if (typeof document === "undefined") return false;
  if (document.hidden) return true;
  try {
    return !document.hasFocus();
  } catch {
    return false;
  }
}

export function showChatPushNotification(message: ChatMessage) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!shouldShowBrowserPush()) return;
  const prefs = useChatPrefsStore.getState();
  const body = prefs.profanityFilter
    ? maskProfanity(message.content)
    : message.content;
  const notification = new Notification(
    `${message.nickname} · ${SITE_CONFIG.name}`,
    {
      body,
      tag: `chat-${message.id}`,
      silent: true,
    },
  );
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

export function notifyChatAlert(
  message: ChatMessage,
  myMessageIds: Set<string>,
  nickname: string | null,
) {
  const relevant =
    isReplyToMe(message, myMessageIds) ||
    isChatMention(message.content, nickname);
  if (!relevant) return;
  const prefs = useChatPrefsStore.getState();
  if (prefs.soundEnabled) playChatAlertSound();
  if (prefs.browserPush) showChatPushNotification(message);
}
