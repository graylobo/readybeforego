'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { DashboardSystem } from '@/lib/api/admin';
import { cn } from '@/lib/utils';
import { SYSTEM_META, SYSTEM_STATE_META } from './dashboard-config';

function knownSystems(systems: DashboardSystem[]) {
  return systems.filter((system) => SYSTEM_META[system.key]);
}

/** 서버 기능 상태 목록 */
export function SystemStatus({ systems }: { systems: DashboardSystem[] }) {
  const items = knownSystems(systems);

  return (
    <section
      aria-labelledby="system-status-heading"
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5"
    >
      <h2 id="system-status-heading" className="text-base font-semibold text-foreground">
        시스템 상태
      </h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">확인할 항목이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((system) => {
            const meta = SYSTEM_META[system.key];
            const state = SYSTEM_STATE_META[system.state];
            const content = (
              <>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', state.dot)} aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {meta.label}
                    <span className="text-xs font-normal text-muted-foreground">{state.label}</span>
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {system.message}
                    {system.checkedAt &&
                      ` · ${formatDistanceToNow(new Date(system.checkedAt), { addSuffix: true, locale: ko })}`}
                  </span>
                </div>
                {meta.href && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </>
            );
            return (
              <li key={system.key}>
                {meta.href ? (
                  <Link
                    href={meta.href}
                    className="-mx-2 flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-1.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 문제가 생긴 기능은 대시보드 맨 위에 알린다 */
export function SystemAlerts({ systems }: { systems: DashboardSystem[] }) {
  const errors = knownSystems(systems).filter((system) => system.state === 'error');
  if (errors.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {errors.map((system) => {
        const meta = SYSTEM_META[system.key];
        return (
          <div
            key={system.key}
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="flex flex-col gap-0.5">
                <strong className="font-semibold text-rose-700 dark:text-rose-400">{meta.label}에 문제가 있습니다</strong>
                <span className="text-rose-700/90 dark:text-rose-300/90">{system.message}</span>
              </div>
            </div>
            {meta.href && (
              <Link
                href={meta.href}
                className="shrink-0 cursor-pointer self-end text-sm font-semibold text-rose-700 hover:underline sm:self-auto dark:text-rose-400"
              >
                확인하기 →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
