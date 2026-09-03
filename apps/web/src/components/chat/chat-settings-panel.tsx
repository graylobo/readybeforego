'use client';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { playChatAlertSound, requestChatPushPermission } from '@/lib/chat/alerts';
import {
  CHAT_FONT_SIZE_MAX,
  CHAT_FONT_SIZE_MIN,
  useChatPrefsStore,
} from '@/lib/stores/chat-prefs.store';
import { Bell, Filter, Minus, Plus, Tag, Type, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

interface ChatSettingsPanelProps {
  onClose: () => void;
}

export function ChatSettingsPanel({ onClose }: ChatSettingsPanelProps) {
  const fontSize = useChatPrefsStore((state) => state.fontSize);
  const soundEnabled = useChatPrefsStore((state) => state.soundEnabled);
  const membersOnly = useChatPrefsStore((state) => state.membersOnly);
  const profanityFilter = useChatPrefsStore((state) => state.profanityFilter);
  const browserPush = useChatPrefsStore((state) => state.browserPush);
  const setFontSize = useChatPrefsStore((state) => state.setFontSize);
  const setSoundEnabled = useChatPrefsStore((state) => state.setSoundEnabled);
  const setMembersOnly = useChatPrefsStore((state) => state.setMembersOnly);
  const setProfanityFilter = useChatPrefsStore((state) => state.setProfanityFilter);
  const setBrowserPush = useChatPrefsStore((state) => state.setBrowserPush);

  const toggleSound = (next: boolean) => {
    setSoundEnabled(next);
    if (next) playChatAlertSound();
  };

  const togglePush = async (next: boolean) => {
    if (!next) {
      setBrowserPush(false);
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }
    const granted = await requestChatPushPermission();
    if (!granted) {
      setBrowserPush(false);
      toast.error('브라우저 알림 권한이 필요합니다.');
      return;
    }
    setBrowserPush(true);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-card">
      <div className="h-12 shrink-0 px-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">채팅 설정</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer"
          onClick={onClose}
          aria-label="설정 닫기"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <SettingRow
          icon={<Type className="h-4 w-4" />}
          title="글자 크기"
          description="채팅 메시지 크기를 조절합니다."
        >
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              onClick={() => setFontSize(fontSize - 1)}
              disabled={fontSize <= CHAT_FONT_SIZE_MIN}
              aria-label="글자 작게"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {fontSize} / {CHAT_FONT_SIZE_MAX}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              onClick={() => setFontSize(fontSize + 1)}
              disabled={fontSize >= CHAT_FONT_SIZE_MAX}
              aria-label="글자 크게"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SettingRow>

        <SettingRow
          icon={<Bell className="h-4 w-4" />}
          title="알림 소리"
          description="@멘션·답글 받을 때 짧은 벨소리"
        >
          <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
        </SettingRow>

        <SettingRow
          icon={<Tag className="h-4 w-4" />}
          title="고정닉 채팅만 보기"
          description="비회원(일회용 닉) 메시지를 숨깁니다. 내 메시지는 항상 표시됩니다."
        >
          <Switch checked={membersOnly} onCheckedChange={setMembersOnly} />
        </SettingRow>

        <SettingRow
          icon={<Filter className="h-4 w-4" />}
          title="비속어 필터"
          description="욕설 단어를 ***로 가립니다. 기본으로 켜져 있습니다."
        >
          <Switch checked={profanityFilter} onCheckedChange={setProfanityFilter} />
        </SettingRow>

        <SettingRow
          icon={<Bell className="h-4 w-4" />}
          title="브라우저 푸시"
          description="다른 창을 보고 있을 때 멘션·답글을 OS 알림으로 받습니다."
        >
          <Switch checked={browserPush} onCheckedChange={(checked) => void togglePush(checked)} />
        </SettingRow>
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <span className="text-muted-foreground">{icon}</span>
            {title}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0 pt-0.5">{children}</div>
      </div>
    </div>
  );
}
