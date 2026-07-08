'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { useRecentBoardsStore } from '@/lib/stores/recent-boards.store';

export function RecentBoards() {
  const { recentBoards, removeBoard } = useRecentBoardsStore();

  if (recentBoards.length === 0) return null;

  return (
    <nav className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide" aria-label="Recent Boards">
      <span className="font-bold text-[15px] text-foreground shrink-0 pl-1 mr-2">최근방문</span>
      <div className="flex items-center gap-2">
        {recentBoards.map((b) => (
          <div 
            key={b.slug}
            className="flex items-center bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground text-sm rounded-full transition-colors whitespace-nowrap border border-transparent hover:border-border/50 group"
          >
            <Link 
              href={`/board/${b.slug}`} 
              className="font-medium py-1.5 pl-3 pr-1.5 cursor-pointer flex-1"
            >
              {b.name}
            </Link>
            <div className="py-1.5 pr-2 pl-1 flex items-center">
              <button
                type="button"
                aria-label="최근 방문 기록에서 삭제"
                onClick={(e) => {
                  e.preventDefault();
                  removeBoard(b.slug);
                }}
                className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
