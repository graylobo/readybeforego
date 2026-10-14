'use client';

import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoardDirectory } from '@/hooks/queries/use-board-community-queries';
import { LayoutGrid, Lock, PlusCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

/**
 * 게시판 목록. 신청으로 생긴 게시판은 사이드바에 넣지 않으므로 여기서 찾는다
 */
export default function BoardsPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const { data: boards, isLoading } = useBoardDirectory(query);

  const systemBoards = (boards ?? []).filter((b) => b.type === 'system');
  const userBoards = (boards ?? []).filter((b) => b.type === 'user');

  return (
    <PageContainer maxWidth="lg" className="py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <LayoutGrid className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">게시판 목록</h1>
            <p className="text-muted-foreground mt-1 text-sm">원하는 게시판이 없으면 직접 개설을 신청할 수 있습니다.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/boards/request">
            <PlusCircle className="w-4 h-4 mr-2" />
            게시판 개설 신청
          </Link>
        </Button>
      </div>

      <form
        className="flex gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="게시판 이름 또는 주소로 찾기" />
        <Button type="submit" variant="secondary">
          <Search className="w-4 h-4" />
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-8">
          <Link href="/board/all" className="block rounded-xl border bg-card p-4 hover:border-primary/50 transition-colors">
            <div className="font-semibold">전체 게시판</div>
            <div className="text-sm text-muted-foreground">모든 게시판의 최신 글을 한 곳에서 봅니다.</div>
          </Link>
          {!query && <BoardSection title="기본 게시판" boards={systemBoards} />}
          <BoardSection
            title={query ? `검색 결과 (${(boards ?? []).length})` : '개설된 게시판'}
            boards={query ? boards ?? [] : userBoards}
            emptyMessage={query ? '검색 결과가 없습니다.' : '아직 개설된 게시판이 없습니다. 첫 게시판을 신청해 보세요.'}
          />
        </div>
      )}
    </PageContainer>
  );
}

function BoardSection({
  title,
  boards,
  emptyMessage,
}: {
  title: string;
  boards: NonNullable<ReturnType<typeof useBoardDirectory>['data']>;
  emptyMessage?: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">{title}</h2>
      {boards.length === 0 ? (
        emptyMessage ? <p className="text-sm text-muted-foreground py-6 text-center border rounded-xl">{emptyMessage}</p> : null
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/board/${board.slug}`}
                className="block h-full rounded-xl border bg-card p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {board.name}
                  {board.isReadOnly && <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-label="읽기 전용" />}
                </div>
                {board.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{board.description}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  글 {board.postCount.toLocaleString()}개
                  {board.managerName && <> · 매니저 {board.managerName}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
