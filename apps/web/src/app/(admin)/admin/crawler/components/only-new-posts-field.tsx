'use client';

import React from 'react';
import { Sparkle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface OnlyNewPostsFieldProps {
  idPrefix?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 저장된 기준 글 번호 (수정 화면에서 보여 줌) */
  baselinePostId?: number | null;
}

/** '켠 이후 올라온 글만 수집' 스위치 */
export function OnlyNewPostsField({ idPrefix = '', checked, onChange, baselinePostId }: OnlyNewPostsFieldProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border">
      <div className="space-y-0.5">
        <Label htmlFor={`${idPrefix}onlyNewPosts`} className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
          <Sparkle className="h-3.5 w-3.5 text-violet-500" /> 켠 이후 올라온 글만 수집
        </Label>
        <p className="text-[11px] text-muted-foreground">
          {checked
            ? baselinePostId
              ? `디시 글 번호 ${baselinePostId.toLocaleString()}번 이후에 올라온 글만 가져옵니다. (수집 대상을 다시 켜면 그 시점으로 바뀜)`
              : '저장하는 순간의 디시 최신 글 이후에 올라온 글만 가져옵니다.'
            : '끄면 페이지 범위 안의 글 중 아직 안 가져온 글을 가져옵니다.'}
        </p>
      </div>
      <Switch id={`${idPrefix}onlyNewPosts`} checked={checked} onCheckedChange={onChange} className="cursor-pointer" />
    </div>
  );
}
