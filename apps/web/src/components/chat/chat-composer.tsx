'use client';

import { useEffect, useRef, useState } from 'react';
import { Reply, X } from 'lucide-react';
import { CHAT_LIMITS, formatChatReplyPreview, type ChatMessage } from '@community/shared-types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface ChatComposerProps {
  disabled?: boolean;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onSend: (content: string, replyToId?: string) => boolean;
}

function isImeComposing(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

export function ChatComposer({ disabled, replyTo, onCancelReply, onSend }: ChatComposerProps) {
  const [value, setValue] = useState('');
  const composingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const submit = () => {
    if (disabled || !value.trim()) return;
    const sent = onSend(value, replyTo?.id);
    if (sent) setValue('');
  };

  return (
    <div className="border-t border-border p-3 shrink-0">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
          <Reply className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <p className="flex-1 min-w-0 text-xs truncate">
            <span className="font-semibold text-emerald-500">{replyTo.nickname}</span>
            <span className="text-muted-foreground"> : {formatChatReplyPreview(replyTo.content)}</span>
          </p>
          <button
            type="button"
            className="shrink-0 h-6 px-1.5 inline-flex items-center gap-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={onCancelReply}
          >
            취소
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, CHAT_LIMITS.MESSAGE_MAX))}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            if (isImeComposing(event) || composingRef.current) return;
            event.preventDefault();
            submit();
          }}
          placeholder={replyTo ? '답글 입력...' : '메시지 입력...'}
          rows={1}
          className={cn(
            'flex-1 min-h-10 max-h-28 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none cursor-text',
            'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          )}
        />
        <Button
          type="button"
          size="sm"
          className="h-10 px-3"
          disabled={disabled || !value.trim()}
          onClick={submit}
        >
          전송
        </Button>
      </div>
      {/* <p className="mt-1.5 text-[11px] text-muted-foreground text-right">
        {value.length}/{CHAT_LIMITS.MESSAGE_MAX}
      </p> */}
    </div>
  );
}
