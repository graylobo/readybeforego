'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardTask } from '@/lib/api/admin';
import { TASK_META } from './dashboard-config';

interface PendingTasksProps {
  tasks: DashboardTask[] | undefined;
  isLoading: boolean;
}

function waitingFor(oldestAt: string) {
  return `${formatDistanceToNowStrict(new Date(oldestAt), { locale: ko })}째 대기`;
}

/**
 * 관리자가 바로 처리할 일. 대기 중인 항목은 카드(좁은 화면은 한 줄 목록)로, 없는 항목은 아래에 작게 모은다
 */
export function PendingTasks({ tasks, isLoading }: PendingTasksProps) {
  const known = (tasks ?? []).filter((task) => TASK_META[task.key]);
  const pending = known.filter((task) => task.count > 0);
  const done = known.filter((task) => task.count === 0);
  const total = pending.reduce((sum, task) => sum + task.count, 0);

  return (
    <section aria-labelledby="pending-tasks-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 id="pending-tasks-heading" className="text-base font-semibold text-foreground">
          처리할 일
        </h2>
        {!isLoading && total > 0 && (
          <span className="text-sm text-muted-foreground">{total.toLocaleString()}건 대기 중</span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl sm:h-[104px]" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          대기 중인 일이 없습니다.
        </div>
      ) : (
        <>
          {/* 좁은 화면: 한 줄씩 촘촘한 목록 */}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:hidden">
            {pending.map((task) => {
              const meta = TASK_META[task.key];
              return (
                <li key={task.key}>
                  <Link href={meta.href} className="flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-accent/50">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{meta.label}</span>
                      {task.oldestAt && <span className="text-xs text-muted-foreground">{waitingFor(task.oldestAt)}</span>}
                    </div>
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {task.count.toLocaleString()}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">건</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* 넓은 화면: 카드 (항목이 많아도 한 줄에 들어가도록 너비를 나눈다) */}
          <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
            {pending.map((task) => {
              const meta = TASK_META[task.key];
              return (
                <Link
                  key={task.key}
                  href={meta.href}
                  className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="truncate">{meta.label}</span>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums md:text-3xl">
                      {task.count.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">건</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{task.oldestAt ? waitingFor(task.oldestAt) : ''}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {!isLoading && pending.length > 0 && done.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>대기 없음</span>
          {done.map((task) => (
            <Link
              key={task.key}
              href={TASK_META[task.key].href}
              className="cursor-pointer rounded-full bg-muted px-2.5 py-1 hover:text-foreground"
            >
              {TASK_META[task.key].label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
