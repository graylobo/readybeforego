'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

export type CrawlDirection = 'newest' | 'oldest';

const OPTIONS: { value: CrawlDirection; label: string; description: string }[] = [
  { value: 'newest', label: '최신 글부터', description: '1페이지 위쪽부터. 새 글이 빨리 들어옴' },
  { value: 'oldest', label: '예전 글부터', description: '끝 페이지 아래쪽부터. 디시 시간 순서대로 쌓임' },
];

/** 수집 방향 (페이지 범위 안에서 어느 쪽 글부터 가져올지) */
export function CrawlDirectionField({ value, onChange }: { value: CrawlDirection; onChange: (value: CrawlDirection) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">수집 방향</Label>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="수집 방향">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md border p-2 text-left transition-colors cursor-pointer',
              value === option.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
            )}
          >
            <span className="block text-xs font-medium">{option.label}</span>
            <span className="block text-[11px] text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
