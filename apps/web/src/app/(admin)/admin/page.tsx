'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/hooks/queries/use-admin-queries';
import {
  Building2,
  MessageSquare,
  Users,
  Film,
  TrendingUp,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-8 h-9 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: '총 사용자',
      value: stats?.users?.total || 0,
      today: stats?.users?.today || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: '개설된 게시판',
      value: stats?.boards || 0,
      icon: Film,
      color: 'bg-purple-500',
    },
    {
      title: '전체 게시글',
      value: stats?.posts?.total || 0,
      today: stats?.posts?.today || 0,
      icon: Building2,
      color: 'bg-green-500',
    },
    {
      title: '누적 댓글',
      value: stats?.comments?.total || 0,
      today: stats?.comments?.today || 0,
      icon: MessageSquare,
      color: 'bg-yellow-500',
    },
  ];

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-foreground">관리자 대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">{stat.value.toLocaleString()}</p>
                  {stat.today !== undefined && (
                    <p className={cn("mt-2 text-xs flex items-center gap-1", stat.today > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                      <TrendingUp className="h-3 w-3" />
                      오늘 +{stat.today}
                    </p>
                  )}
                </div>
                <div className={cn("rounded-xl p-3 flex items-center justify-center", stat.color)}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-foreground">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              게시판별 활성도
            </div>
          </h2>
          <div className="flex flex-col gap-4">
            {stats?.topBoards?.map((board: any) => (
              <div key={board.id} className="flex items-center justify-between pb-3 border-b border-dashed border-border last:border-0 last:pb-0">
                <div>
                  <p className="text-[15px] font-medium">{board.name}</p>
                  <p className="text-xs text-muted-foreground">/board/{board.slug}</p>
                </div>
                <div className="text-sm font-semibold bg-muted px-2 py-1 rounded-md">
                  {board.postCount} 포스트
                </div>
              </div>
            ))}
            {(!stats?.topBoards || stats?.topBoards.length === 0) && (
              <p className="text-sm text-center text-muted-foreground py-4">게시판 데이터가 없습니다.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-foreground">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              최근 제재 기록
            </div>
          </h2>
          <div className="flex flex-col gap-4">
            {stats?.recentModerationLogs?.map((log: any) => (
              <div key={log.id} className="p-3 bg-muted/30 rounded-lg text-sm">
                <div className="flex justify-between mb-1">
                  <span className={cn(
                    "font-semibold text-xs",
                    log.type === 'BAN' ? 'text-red-500' : 
                    log.type === 'SUSPENSION' ? 'text-orange-500' : 'text-blue-500'
                  )}>
                    {log.type}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ko })}
                  </span>
                </div>
                <div className="text-foreground leading-normal">
                  <strong>{log.user?.name}</strong>: {log.reason}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  관리자: {log.admin?.name}
                </div>
              </div>
            ))}
            {(!stats?.recentModerationLogs || stats?.recentModerationLogs.length === 0) && (
              <p className="text-sm text-center text-muted-foreground py-4">최근 제재 기록이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
