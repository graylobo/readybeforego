'use client';

import Link from 'next/link';
import type { AdminDashboard } from '@/lib/api/admin';

interface TopBoardsProps {
  boards: AdminDashboard['topBoards'];
  periodLabel: string;
}

/** 기간 안에 사람이 쓴 글이 많은 게시판 */
export function TopBoards({ boards, periodLabel }: TopBoardsProps) {
  const max = Math.max(1, ...boards.map((board) => board.postCount));

  return (
    <section
      aria-labelledby="top-boards-heading"
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="top-boards-heading" className="text-base font-semibold text-foreground">
          활발한 게시판
        </h2>
        <span className="text-xs text-muted-foreground">{periodLabel} 글 수</span>
      </div>
      {boards.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">이 기간에 올라온 글이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/board/${board.slug}`}
                className="flex cursor-pointer flex-col gap-1.5 rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{board.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {board.postCount.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${(board.postCount / max) * 100}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
