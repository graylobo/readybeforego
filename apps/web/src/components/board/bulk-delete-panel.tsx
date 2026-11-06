'use client';

import { Button } from '@/components/ui/button';
import { useBulkDeletePosts } from '@/hooks/queries/use-board-queries';
import type { Post } from '@/lib/api/board';
import { cn } from '@/lib/utils/cn';
import { useState } from 'react';
import { toast } from 'sonner';

/** 서버의 한 번 일괄 삭제 한도와 같다 (넘으면 최신 글부터 이만큼 지우고, 다시 누르면 나머지를 지운다) */
const BULK_DELETE_LIMIT = 500;

interface BulkDeletePanelProps {
  /** 지금 페이지에 보이는 글 */
  posts: Post[];
  /** 검색 결과 전체 글 수 */
  totalCount: number;
  /** 검색 화면의 조건 (검색 결과 전체 삭제에 그대로 쓴다) */
  search: { searchType?: string; searchQuery?: string; authorId?: string };
  onClose: () => void;
}

/**
 * 검색 결과 일괄 삭제 (Super Admin 전용). 이 페이지의 글을 골라 지우거나, 검색 결과 전체를 지운다.
 * DB에서 완전히 지운다: 글, 댓글·답글, 추천·스크랩, 알림, 글 이미지와 댓글 첨부 이미지까지 (되돌릴 수 없다)
 */
export function BulkDeletePanel({ posts, totalCount, search, onClose }: BulkDeletePanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allResults, setAllResults] = useState(false);
  const bulkDelete = useBulkDeletePosts();

  const pageAllSelected = posts.length > 0 && posts.every((post) => selected.has(post.id));
  const selectedCount = allResults ? Math.min(totalCount, BULK_DELETE_LIMIT) : selected.size;

  const togglePost = (id: string) => {
    setAllResults(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setAllResults(false);
    setSelected(pageAllSelected ? new Set() : new Set(posts.map((post) => post.id)));
  };

  const handleDelete = () => {
    if (selectedCount === 0) return;
    const overLimit = allResults && totalCount > BULK_DELETE_LIMIT;
    const message = [
      `${selectedCount}개의 글을 삭제합니다.`,
      overLimit ? `검색 결과가 ${totalCount}개라 최신 글부터 ${BULK_DELETE_LIMIT}개만 지웁니다. 나머지는 다시 삭제하세요.` : '',
      '글과 댓글·답글, 첨부 이미지가 모두 완전히 지워지며 되돌릴 수 없습니다.',
    ]
      .filter(Boolean)
      .join('\n');
    if (!confirm(message)) return;

    bulkDelete.mutate(allResults ? { search } : { ids: [...selected] }, {
      onSuccess: ({ deleted, failed }) => {
        toast.success(failed ? `${deleted}개 삭제, ${failed}개는 이미 지워졌거나 삭제하지 못했습니다.` : `${deleted}개의 글을 삭제했습니다.`);
        setSelected(new Set());
        setAllResults(false);
        onClose();
      },
      onError: (error: any) => toast.error(error?.message || '일괄 삭제에 실패했습니다.'),
    });
  };

  return (
    <div className="bg-card border shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input type="checkbox" className="h-4 w-4 cursor-pointer" checked={pageAllSelected} onChange={togglePage} />
          이 페이지 전체 선택
        </label>
        <span className="text-sm text-muted-foreground">{selectedCount}개 선택</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={bulkDelete.isPending}>
            취소
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={selectedCount === 0 || bulkDelete.isPending}>
            {bulkDelete.isPending ? '삭제 중...' : `선택한 ${selectedCount}개 삭제`}
          </Button>
        </div>
      </div>

      {/* 메일 서비스처럼: 이 페이지를 모두 고르면 검색 결과 전체를 고를 수 있게 */}
      {pageAllSelected && totalCount > posts.length && (
        <div className="px-4 py-2 text-sm text-center border-b bg-primary/5">
          {allResults ? (
            <>
              검색 결과 전체 {totalCount}개를 선택했습니다
              {totalCount > BULK_DELETE_LIMIT && ` (한 번에 최신 글부터 ${BULK_DELETE_LIMIT}개씩 삭제)`}.{' '}
              <button type="button" className="text-primary underline cursor-pointer" onClick={() => setAllResults(false)}>
                선택 해제
              </button>
            </>
          ) : (
            <>
              이 페이지의 {posts.length}개를 선택했습니다.{' '}
              <button type="button" className="text-primary underline cursor-pointer" onClick={() => setAllResults(true)}>
                검색 결과 전체 {totalCount}개 선택
              </button>
            </>
          )}
        </div>
      )}

      <ul className="divide-y">
        {posts.map((post) => {
          const checked = allResults || selected.has(post.id);
          return (
            <li key={post.id}>
              <label className={cn('flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40', checked && 'bg-destructive/5')}>
                <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer" checked={checked} onChange={() => togglePost(post.id)} />
                <span className="shrink-0 text-xs text-muted-foreground w-20 truncate">{post.board?.name}</span>
                <span className="flex-1 min-w-0 truncate text-sm">{post.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground w-24 truncate text-right">
                  {post.user?.name || post.guestName || '익명'}
                </span>
                <span className="hidden sm:inline shrink-0 text-xs text-muted-foreground w-20 text-right">
                  {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
