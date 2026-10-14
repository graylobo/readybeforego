'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { RecentBoard, useRecentBoardsStore } from '@/lib/stores/recent-boards.store';

const noopSubscribe = () => () => {};

/**
 * @param current 지금 보고 있는 게시판. 방문 기록은 브라우저 저장소에 있어 서버는 모르므로,
 *   서버 렌더링과 하이드레이션 중에는 이 게시판만 그리고(줄 높이가 미리 잡혀 본문이 밀리지 않게) 이후 저장된 기록으로 바꾼다
 */
export function RecentBoards({ current }: { current?: RecentBoard }) {
  const { recentBoards: storedBoards, removeBoard } = useRecentBoardsStore();
  // 서버 렌더링/하이드레이션 중에는 false, 이후 true (저장소 값이 달라 생기는 하이드레이션 불일치 방지)
  const isHydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const recentBoards = isHydrated ? storedBoards : current ? [current] : [];

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
