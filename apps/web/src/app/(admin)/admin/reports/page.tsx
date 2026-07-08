'use client';

import React, { useMemo } from 'react';
import { useAdminReports, useResolveReport } from '@/hooks/queries/use-report-queries';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePaginationLimit } from '@/hooks/use-pagination-limit';
import { CommonPagination } from '@/components/common/common-pagination';
import { UserProfilePopover } from '@/components/common/user-profile-popover';

import { AgGridReact } from 'ag-grid-react';
import { 
  ClientSideRowModelModule, 
  ModuleRegistry, 
  ColDef,
  TextFilterModule,
  NumberFilterModule
} from 'ag-grid-community';

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Register AG Grid modules
ModuleRegistry.registerModules([
  ClientSideRowModelModule, 
  TextFilterModule,
  NumberFilterModule
]);

// Component for Status Badge
const StatusRenderer = (params: any) => {
  const { status } = params.data;
  let badge;
  switch (status) {
    case 'pending':
      badge = <span className="text-yellow-600 text-[11px] font-bold">대기중</span>; break;
    case 'resolved':
      badge = <span className="text-green-600 text-[11px] font-bold">처리완료</span>; break;
    case 'rejected':
      badge = <span className="text-muted-foreground text-[11px] font-bold">반려됨</span>; break;
    default:
      badge = <span>{status}</span>;
  }

  return (
    <div className="flex flex-col justify-center h-full py-1">
      <div className="flex items-center">{badge}</div>
    </div>
  );
};

// Component for Reporter with UserProfilePopover
const ReporterRenderer = (params: any) => {
  const reporter = params.value;
  if (!reporter) return <div className="flex items-center h-full"><span className="text-muted-foreground italic text-xs">익명</span></div>;

  return (
    <div className="flex flex-col justify-center h-full py-1">
      <UserProfilePopover
        userId={reporter.id || reporter.email} // fallback to email if id lacks
        userName={reporter.name}
        userPicture={reporter.picture}
        className="font-medium text-xs hover:text-primary transition-colors cursor-pointer truncate"
      >
        {reporter.name}
      </UserProfilePopover>
      <div className="text-[10px] text-muted-foreground leading-tight truncate">{reporter.email}</div>
    </div>
  );
};

// Actions Component
const ActionsRenderer = (params: any) => {
  const { data, context } = params;
  if (data.status !== 'pending') return null;

  return (
    <div className="flex items-center gap-1.5 h-full">
      <Button 
        variant="outline" 
        size="sm" 
        className="h-7 px-2 text-[11px]"
        onClick={() => context.handleStatusChange(data.id, 'resolved')}
        disabled={context.isPending}
      >
        처리완료
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
        onClick={() => context.handleStatusChange(data.id, 'rejected')}
        disabled={context.isPending}
      >
        반려
      </Button>
    </div>
  );
};

export default function AdminReportsPage() {
  const [page, setPage] = usePaginationLimit('admin-reports-page', 1);
  const [limit, setLimit] = usePaginationLimit('admin-reports-limit', 20);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [targetFilter, setTargetFilter] = React.useState<string>('all');
  
  const { data, isLoading } = useAdminReports(
    page, 
    limit, 
    statusFilter === 'all' ? undefined : statusFilter,
    targetFilter === 'all' ? undefined : targetFilter
  );
  const resolveReport = useResolveReport();

  const handleStatusChange = (id: string, status: 'resolved' | 'rejected') => {
    resolveReport.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast.success(status === 'resolved' ? '신고를 처리완료 상태로 변경했습니다.' : '신고를 반려했습니다.');
      },
      onError: () => {
        toast.error('상태 변경 중 오류가 발생했습니다.');
      }
    });
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'target',
      headerName: '대상',
      width: 250,
      cellRenderer: (params: any) => {
        const { targetType, targetId, targetUrl } = params.data;
        return (
          <div className="flex flex-col justify-center h-full py-1 gap-0.5">
            <div className="flex items-center">
              <span className={`text-[11px] font-bold ${targetType === 'POST' ? 'text-primary' : 'text-foreground'}`}>
                {targetType === 'POST' ? '게시글' : '댓글'}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate w-full" title={targetId}>
              {targetUrl ? (
                <Link href={targetUrl} className="hover:underline hover:text-primary transition-colors" target="_blank">
                  {targetId}
                </Link>
              ) : targetId}
            </div>
          </div>
        );
      }
    },
    {
      field: 'reporter',
      headerName: '신고자',
      width: 180,
      cellRenderer: ReporterRenderer
    },
    {
      field: 'reason',
      headerName: '신고사유',
      flex: 1,
      minWidth: 200,
      cellRenderer: (params: any) => (
        <div className="flex items-center h-full text-xs">
          <p className="truncate" title={params.value}>{params.value}</p>
        </div>
      )
    },
    {
      field: 'createdAt',
      headerName: '접수일시',
      width: 140,
      cellRenderer: (params: any) => (
        <div className="flex items-center h-full text-xs text-muted-foreground">
          {format(new Date(params.value), 'yyyy.MM.dd HH:mm', { locale: ko })}
        </div>
      )
    },
    {
      field: 'status',
      headerName: '상태',
      width: 120,
      cellRenderer: StatusRenderer
    },
    {
      field: 'resolvedAt',
      headerName: '처리일시',
      width: 140,
      cellRenderer: (params: any) => {
        if (!params.value) return <div className="flex items-center h-full text-xs text-muted-foreground">-</div>;
        return (
          <div className="flex items-center h-full text-xs text-muted-foreground">
            {format(new Date(params.value), 'yyyy.MM.dd HH:mm', { locale: ko })}
          </div>
        );
      }
    },
    {
      headerName: '관리',
      width: 150,
      sortable: false,
      filter: false,
      cellRenderer: ActionsRenderer
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div>
           <Skeleton className="h-8 w-48 mb-2" />
           <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">신고 관리</h1>
          <p className="text-muted-foreground mt-2">
            사용자들이 접수한 게시글 및 댓글 신고 내역을 확인하고 처리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={targetFilter} onValueChange={(v) => { setTargetFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="대상 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 대상</SelectItem>
              <SelectItem value="POST">게시글</SelectItem>
              <SelectItem value="COMMENT">댓글</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="상태 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="resolved">처리완료</SelectItem>
              <SelectItem value="rejected">반려됨</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 min-h-[500px] bg-card rounded-xl border shadow-sm overflow-hidden ag-theme-quartz-dark dark:ag-theme-quartz-dark h-full w-full">
        <AgGridReact
          rowData={data?.items || []}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ 
            handleStatusChange,
            isPending: resolveReport.isPending
          }}
          theme="legacy"
          rowHeight={64}
        />
      </div>

      {totalPages > 0 && (
        <div className="mt-4">
            <CommonPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
                itemsPerPage={limit}
                onItemsPerPageChange={(newLimit) => {
                    setLimit(newLimit);
                    setPage(1);
                }}
            />
        </div>
      )}
    </div>
  );
}
