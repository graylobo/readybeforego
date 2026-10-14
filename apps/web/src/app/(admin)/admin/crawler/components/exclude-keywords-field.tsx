'use client';

import React, { useMemo } from 'react';
import { parseExcludeKeywords } from '@community/shared-types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ExcludeKeywordsFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * 제외 키워드 입력칸. 제목이나 본문에 이 단어가 있는 글은 수집하지 않는다.
 * (해석 규칙은 API와 같은 shared-types의 parseExcludeKeywords를 사용)
 */
export function ExcludeKeywordsField({ id, value, onChange }: ExcludeKeywordsFieldProps) {
  const keywords = useMemo(() => parseExcludeKeywords(value), [value]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>제외 키워드</Label>
      <Textarea
        id={id}
        rows={2}
        placeholder="예: 광고, 홍보, 코인"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keywords.map((k) => (
            <span
              key={k}
              className="inline-flex items-center rounded border border-rose-500/30 bg-rose-500/5 px-1.5 py-0.5 text-[11px] text-rose-600 dark:text-rose-400"
            >
              {k}
            </span>
          ))}
        </div>
      )}
      <span className="block text-[11px] text-muted-foreground">
        제목이나 본문에 이 단어가 들어 있는 글은 수집하지 않습니다. 쉼표(,)나 줄바꿈으로 구분하며, 대소문자와
        띄어쓰기는 무시합니다 (&quot;광고&quot;를 적으면 &quot;광 고&quot;도 걸러짐).
      </span>
    </div>
  );
}
