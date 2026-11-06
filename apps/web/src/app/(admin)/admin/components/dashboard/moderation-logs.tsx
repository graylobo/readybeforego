'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { DashboardModerationLog } from '@/lib/api/admin';
import { cn } from '@/lib/utils';
import { MODERATION_TYPE_META } from './dashboard-config';

function TypeBadge({ log }: { log: DashboardModerationLog }) {
  const meta = MODERATION_TYPE_META[log.type] ?? { label: log.type, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold', meta.className)}>
      {meta.label}
      {log.type === 'SUSPENSION' && log.durationDays ? ` ${log.durationDays}일` : ''}
    </span>
  );
}

function timeAgo(at: string) {
  return formatDistanceToNow(new Date(at), { addSuffix: true, locale: ko });
}

/** 최근 제재 (넓은 화면은 표, 좁은 화면은 목록) */
export function ModerationLogs({ logs }: { logs: DashboardModerationLog[] }) {
  return (
    <section
      aria-labelledby="moderation-logs-heading"
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 md:px-5">
        <h2 id="moderation-logs-heading" className="text-base font-semibold text-foreground">
          최근 제재
        </h2>
        <Link href="/admin/users" className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          사용자 관리 →
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">최근 제재 기록이 없습니다.</p>
      ) : (
        <>
          <ul className="divide-y divide-border md:hidden">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TypeBadge log={log} />
                    <span className="truncate text-sm font-medium">{log.user?.name ?? '탈퇴한 사용자'}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{log.reason}</p>
              </li>
            ))}
          </ul>

          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">구분</th>
                <th className="px-2 py-2.5 font-medium">대상</th>
                <th className="px-2 py-2.5 font-medium">사유</th>
                <th className="px-2 py-2.5 font-medium">처리자</th>
                <th className="px-5 py-2.5 text-right font-medium">시간</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <TypeBadge log={log} />
                  </td>
                  <td className="max-w-[160px] truncate px-2 py-3 font-medium">{log.user?.name ?? '탈퇴한 사용자'}</td>
                  <td className="px-2 py-3 text-muted-foreground">{log.reason}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-muted-foreground">{log.admin?.name ?? '-'}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-muted-foreground">{timeAgo(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
