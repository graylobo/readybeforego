'use client';

import { CommonPagination } from '@/components/common/common-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoardRequests, useReviewBoardRequest } from '@/hooks/queries/use-board-community-queries';
import { toast } from '@/lib/toast';
import { formatSiteDate } from '@/lib/utils/date';
import type { BoardRequest } from '@community/shared-types';
import Link from 'next/link';
import { useState } from 'react';

const STATUS_TABS = [
  { value: 'pending', label: '검토 대기' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '반려됨' },
  { value: 'all', label: '전체' },
] as const;
const PAGE_LIMIT = 20;

/**
 * 게시판 개설 신청 처리 (사이트 관리자). 승인하면 게시판이 만들어지고 신청자가 매니저가 되며, 결과는 신청자에게 알림으로 간다
 */
export default function AdminBoardRequestsPage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['value']>('pending');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBoardRequests(status, page);
  const review = useReviewBoardRequest();
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_LIMIT);

  const approve = (request: BoardRequest) => {
    if (!confirm(`'${request.name}' (/board/${request.slug}) 게시판을 개설할까요?\n신청자가 매니저가 됩니다.`)) return;
    review.mutate({ id: request.id, status: 'approved' }, { onSuccess: () => toast.success('게시판을 개설했습니다.') });
  };
  const reject = (request: BoardRequest) => {
    const reason = prompt(`'${request.name}' 신청을 반려합니다. 신청자에게 보낼 사유를 입력하세요. (비워도 됩니다)`);
    if (reason === null) return;
    review.mutate({ id: request.id, status: 'rejected', rejectReason: reason.trim() || undefined }, { onSuccess: () => toast.success('반려했습니다.') });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">게시판 개설 신청</h1>
        <p className="text-sm text-muted-foreground mt-1">승인하면 신청한 회원이 그 게시판의 매니저가 됩니다. 매니저 변경은 게시판 관리에서 할 수 있습니다.</p>
      </div>

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={status === tab.value ? 'default' : 'outline'}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center border rounded-lg">신청이 없습니다.</p>
      ) : (
        <ul className="divide-y border rounded-lg bg-card">
          {data!.items.map((request) => (
            <li key={request.id} className="p-4 flex flex-col md:flex-row md:items-start gap-3 justify-between">
              <div className="min-w-0 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{request.name}</span>
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">/board/{request.slug}</span>
                  <Badge variant={request.status === 'pending' ? 'secondary' : request.status === 'approved' ? 'default' : 'destructive'}>
                    {STATUS_TABS.find((t) => t.value === request.status)?.label}
                  </Badge>
                </div>
                {request.description && <p className="text-muted-foreground">{request.description}</p>}
                {request.reason && <p className="whitespace-pre-line">신청 사유: {request.reason}</p>}
                {request.rejectReason && <p className="text-destructive">반려 사유: {request.rejectReason}</p>}
                <p className="text-xs text-muted-foreground">
                  신청자 {request.requester?.name ?? '탈퇴한 회원'} · {formatSiteDate(request.createdAt, 'yyyy.MM.dd HH:mm')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {request.status === 'pending' ? (
                  <>
                    <Button size="sm" disabled={review.isPending} onClick={() => approve(request)}>승인</Button>
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => reject(request)}>반려</Button>
                  </>
                ) : request.status === 'approved' && request.boardId ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/board/${request.slug}`} target="_blank">게시판 보기</Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && <CommonPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}
