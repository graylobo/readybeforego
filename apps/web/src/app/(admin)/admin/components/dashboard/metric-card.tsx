'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number | string;
  /** 기간 안의 증가 (예: "최근 7일 +38") */
  increase?: string;
  /** 보조 설명 (지난 기간 대비 등) */
  detail?: ReactNode;
  /** 날짜별 값 (오래된 순) — 있으면 아래에 추이를 그린다 */
  series?: number[];
  className?: string;
}

export function MetricCard({ label, value, increase, detail, series, className }: MetricCardProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-4 md:p-5', className)}>
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums md:text-3xl">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <div className="flex min-h-4 flex-wrap gap-x-2 gap-y-0.5 text-xs">
        {increase && <span className="font-semibold text-emerald-600 dark:text-emerald-400">{increase}</span>}
        {detail && <span className="text-muted-foreground">{detail}</span>}
      </div>
      {series && series.length > 1 && <Sparkline values={series} className="mt-1 h-8 w-full text-blue-500" />}
    </div>
  );
}

/** 지난 기간 대비 변화 */
export function formatChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? '지난 기간과 같음' : '지난 기간 0';
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return '지난 기간과 비슷';
  return `지난 기간보다 ${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`;
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 100;
  const height = 32;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - 2 - ((value - min) / (max - min || 1)) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" className={cn(className)}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
