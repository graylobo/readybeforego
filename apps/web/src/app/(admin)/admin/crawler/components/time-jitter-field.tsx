'use client';

import React from 'react';
import { Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/lib/toast';

const DEFAULT_JITTER_MIN = 10;
const DEFAULT_JITTER_MAX = 120;

export type PostOrderMode = 'ordered' | 'shuffled';

export interface TimeJitterValue {
  realtime: boolean;
  min: number;
  max: number;
  /** 등록 순서 (실시간 등록이면 항상 순서대로라 고를 수 없음) */
  order: PostOrderMode;
}

/**
 * 저장된 분산 범위로 화면 상태 생성.
 * 백엔드는 최소/최대가 모두 0이면 실시간(방금 전) 등록으로 처리한다 (crawler.service.ts isRealtime).
 * 실시간이면 토글을 끌 때 보여줄 값으로 기본 범위를 채워 둔다.
 */
export function toTimeJitterValue(min?: number | null, max?: number | null, order?: string | null): TimeJitterValue {
  const resolvedMin = min ?? DEFAULT_JITTER_MIN;
  const resolvedMax = max ?? DEFAULT_JITTER_MAX;
  const resolvedOrder: PostOrderMode = order === 'shuffled' ? 'shuffled' : 'ordered';
  if (Math.max(resolvedMin, resolvedMax) === 0) {
    return { realtime: true, min: DEFAULT_JITTER_MIN, max: DEFAULT_JITTER_MAX, order: resolvedOrder };
  }
  return { realtime: false, min: resolvedMin, max: resolvedMax, order: resolvedOrder };
}

/**
 * 화면 상태를 API 저장 값으로 변환. 실시간이 아닌데 범위가 0~0이면 null (저장 불가).
 */
export function toTimeJitterPayload(
  value: TimeJitterValue,
): { timeJitterMinMinutes: number; timeJitterMaxMinutes: number; postOrderMode: PostOrderMode } | null {
  if (value.realtime) {
    return { timeJitterMinMinutes: 0, timeJitterMaxMinutes: 0, postOrderMode: value.order };
  }
  const min = Number(value.min);
  const max = Number(value.max);
  if (Math.max(min, max) <= 0) {
    toast.error('실시간 등록이 아니면 최대 분산 시간을 1분 이상으로 입력해주세요.');
    return null;
  }
  return { timeJitterMinMinutes: min, timeJitterMaxMinutes: max, postOrderMode: value.order };
}

interface TimeJitterFieldProps {
  idPrefix?: string;
  value: TimeJitterValue;
  onChange: (value: TimeJitterValue) => void;
}

export function TimeJitterField({ idPrefix = '', value, onChange }: TimeJitterFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3 text-muted-foreground" /> 등록 시간 (글 + 댓글 일괄 적용)
        </Label>
        <span className="text-[10px] text-muted-foreground">자연스러운 활동 타임라인 형성</span>
      </div>

      <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border">
        <div className="space-y-0.5">
          <Label
            htmlFor={`${idPrefix}jitterRealtime`}
            className="text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" /> 실시간 등록
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {value.realtime
              ? '글과 댓글을 수집 즉시 "방금 전" 시각으로 등록합니다.'
              : '아래 범위 안에서 과거 시각으로 분산해 등록합니다.'}
          </p>
        </div>
        <Switch
          id={`${idPrefix}jitterRealtime`}
          checked={value.realtime}
          onCheckedChange={(checked) => onChange({ ...value, realtime: checked })}
          className="cursor-pointer"
        />
      </div>

      {!value.realtime && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}jitterMin`} className="text-[11px] text-muted-foreground">
              최소 (분 전)
            </Label>
            <Input
              id={`${idPrefix}jitterMin`}
              type="number"
              min="0"
              value={value.min}
              onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}jitterMax`} className="text-[11px] text-muted-foreground">
              최대 (분 전)
            </Label>
            <Input
              id={`${idPrefix}jitterMax`}
              type="number"
              min="0"
              value={value.max}
              onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {!value.realtime && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">등록 순서</Label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="등록 순서">
            {ORDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={value.order === option.value}
                onClick={() => onChange({ ...value, order: option.value })}
                className={cn(
                  'rounded-md border p-2 text-left transition-colors cursor-pointer',
                  value.order === option.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
                )}
              >
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="block text-[11px] text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ORDER_OPTIONS: { value: PostOrderMode; label: string; description: string }[] = [
  { value: 'ordered', label: '순서 유지', description: '디시 순서대로 (글 간격은 무작위)' },
  { value: 'shuffled', label: '섞기', description: '글마다 범위 안에서 따로 정해 순서가 섞임' },
];
