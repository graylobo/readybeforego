'use client';

import React, { useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { usePosts } from '@/hooks/queries/use-board-queries';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePaginationLimit } from '@/hooks/use-pagination-limit';
import { CommonPagination } from '@/components/common/common-pagination';
import { UserProfilePopover } from '@/components/common/user-profile-popover';
import { Comments } from '@/components/comments/comments';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const stripHtml = (html: string) => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
};

import { AgGridReact } from 'ag-grid-react';
import { 
  AllCommunityModule,
  ModuleRegistry, 
  ColDef
} from 'ag-grid-community';

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Register AG Grid modules
ModuleRegistry.registerModules([
  AllCommunityModule
]);

// Component for Status Badge
const InquiryStatusRenderer = (params: any) => {
  const commentCount = params.data.commentCount || 0;
  const isAnswered = commentCount > 0;

  return (
    <div className="flex items-center h-full py-1">
      {isAnswered ? (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/20 text-[11px] gap-1 py-0.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          답변 완료 ({commentCount})
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border-amber-500/20 text-[11px] gap-1 py-0.5">
          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          답변 대기
        </Badge>
      )}
    </div>
  );
};

// Component for Inquiry Author
const AuthorRenderer = (params: any) => {
  const post = params.data;
  const author = post.user;
  const authorName = author?.name || post.guestName || '익명';
  const authorEmail = author?.email || post.ipAddress || '-';

  return (
    <div className="flex flex-col justify-center h-full py-1 leading-tight">
      {author?.id ? (
        <UserProfilePopover
          userId={author.id}
          userName={author.name}
          userPicture={author.picture}
          className="font-semibold text-xs hover:text-primary transition-colors cursor-pointer truncate"
        >
          {authorName}
        </UserProfilePopover>
      ) : (
        <span className="font-semibold text-xs text-foreground truncate">{authorName}</span>
      )}
      <span className="text-[10px] text-muted-foreground truncate">{authorEmail}</span>
    </div>
  );
};

export default function AdminInquiriesPage() {
  const { resolvedTheme } = useTheme();
  const gridThemeClass = resolvedTheme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';
  const queryClient = useQueryClient();

  const [page, setPage] = usePaginationLimit('admin-inquiries-page', 1);
  const [limit, setLimit] = usePaginationLimit('admin-inquiries-limit', 20);
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all | pending | answered
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);

  // Fetch inquiry board posts
  const { data: postsData, isLoading } = usePosts('inquiry', page, limit);

  const rawInquiries = postsData?.items || [];
  const totalCount = postsData?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Client-side filter by answered status
  const filteredInquiries = useMemo(() => {
    if (statusFilter === 'pending') {
      return rawInquiries.filter((p: any) => (p.commentCount || 0) === 0);
    }
    if (statusFilter === 'answered') {
      return rawInquiries.filter((p: any) => (p.commentCount || 0) > 0);
    }
    return rawInquiries;
  }, [rawInquiries, statusFilter]);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'status',
      headerName: '상태',
      width: 130,
      cellRenderer: InquiryStatusRenderer,
    },
    {
      field: 'title',
      headerName: '문의 제목 & 내용 요약',
      flex: 1.5,
      minWidth: 260,
      cellRenderer: (params: any) => {
        const post = params.data;
        const cleanContent = stripHtml(post.content || '');
        return (
          <div 
            className="flex flex-col justify-center h-full py-1 cursor-pointer group"
            onClick={() => setSelectedInquiry(post)}
          >
            <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
              {post.title}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {cleanContent}
            </div>
          </div>
        );
      }
    },
    {
      field: 'user',
      headerName: '문의자',
      width: 180,
      cellRenderer: AuthorRenderer,
    },
    {
      field: 'createdAt',
      headerName: '접수일시',
      width: 140,
      cellRenderer: (params: any) => (
        <div className="flex items-center h-full text-xs text-muted-foreground">
          {format(new Date(params.value), 'yyyy.MM.dd HH:mm', { locale: ko })}
        </div>
      ),
    },
    {
      field: 'actions',
      headerName: '관리',
      width: 130,
      cellRenderer: (params: any) => {
        const post = params.data;
        return (
          <div className="flex items-center gap-1.5 h-full">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2.5 text-[11px] font-semibold gap-1 cursor-pointer"
              onClick={() => setSelectedInquiry(post)}
            >
              <MessageSquare className="w-3 h-3" />
              상세 / 답변
            </Button>
          </div>
        );
      }
    }
  ], []);

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">1:1 문의/신고 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            유저들이 접수한 1:1 개인 문의 및 신고 내역을 확인하고 바로 답변을 작성하세요.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/board/inquiry" target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="w-3.5 h-3.5" />
              문의 게시판 이동
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-3.5 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">답변 상태:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 ({rawInquiries.length})</SelectItem>
              <SelectItem value="pending">답변 대기 ({rawInquiries.filter(p => (p.commentCount || 0) === 0).length})</SelectItem>
              <SelectItem value="answered">답변 완료 ({rawInquiries.filter(p => (p.commentCount || 0) > 0).length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Data Grid */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`${gridThemeClass} w-full h-[540px] rounded-xl overflow-hidden border border-border shadow-xs`}>
            <AgGridReact
              theme="legacy"
              rowData={filteredInquiries}
              columnDefs={columnDefs}
              rowHeight={52}
              headerHeight={42}
              suppressCellFocus={true}
              animateRows={true}
              overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>접수된 1:1 문의가 없습니다.</span>"
            />
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <CommonPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Inquiry Detail & Reply Modal */}
      {selectedInquiry && (
        <Dialog open={!!selectedInquiry} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden bg-background border border-border rounded-2xl flex flex-col">
            <DialogHeader className="px-5 py-3.5 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>1:1 문의 상세</span>
                {(selectedInquiry.commentCount || 0) > 0 ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/20 text-xs">
                    답변 완료 ({selectedInquiry.commentCount})
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border-amber-500/20 text-xs">
                    답변 대기
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Inquiry Header Info */}
              <div className="space-y-2 pb-4 border-b border-border">
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  {selectedInquiry.title}
                </h2>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {selectedInquiry.user?.name || selectedInquiry.guestName || '익명'}
                    </span>
                    {selectedInquiry.user?.email && (
                      <span>({selectedInquiry.user.email})</span>
                    )}
                  </div>
                  <span>{format(new Date(selectedInquiry.createdAt), 'yyyy.MM.dd HH:mm:ss', { locale: ko })}</span>
                </div>
              </div>

              {/* Inquiry Content */}
              <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90 bg-muted/20 p-4 rounded-xl border border-border/50">
                {stripHtml(selectedInquiry.content || '')}
              </div>

              {/* Admin Reply Comments Area */}
              <div className="pt-3 border-t border-border space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  관리자 답변 및 대화 목록
                </h3>
                <Comments 
                  targetType="post" 
                  targetId={selectedInquiry.id} 
                  allowAnonymous={false} 
                  onMutationSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['board'] });
                  }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
