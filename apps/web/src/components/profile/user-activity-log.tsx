'use client';

import { useMyLogs } from '@/hooks/queries/use-log-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  LogIn, 
  FileText, 
  MessageSquare, 
  Heart, 
  UserCog, 
  Trash2, 
  Clock,
  ShieldAlert
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export function UserActivityLog() {
  const { data: logs, isLoading } = useMyLogs();

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'LOGIN': return <LogIn className="w-4 h-4 text-blue-500" />;
      case 'POST_CREATE': return <FileText className="w-4 h-4 text-green-500" />;
      case 'COMMENT_CREATE': return <MessageSquare className="w-4 h-4 text-orange-500" />;
      case 'LIKE': return <Heart className="w-4 h-4 text-red-500" />;
      case 'UPDATE_PROFILE': return <UserCog className="w-4 h-4 text-purple-500" />;
      case 'DELETE_POST': return <Trash2 className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLogBadge = (type: string) => {
    switch (type) {
      case 'LOGIN': return <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50">로그인</Badge>;
      case 'POST_CREATE': return <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50">글 작성</Badge>;
      case 'COMMENT_CREATE': return <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-600 bg-orange-50">댓글</Badge>;
      case 'LIKE': return <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50">추천</Badge>;
      case 'UPDATE_PROFILE': return <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600 bg-purple-50">설정 변경</Badge>;
      case 'DELETE_POST': return <Badge variant="outline" className="text-[10px] border-destructive/20 text-destructive bg-destructive/5">삭제</Badge>;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card className="border-none shadow-sm bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
          <Clock className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">활동 내역이 아직 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={log.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-muted rounded-full shrink-0">
                {getLogIcon(log.type)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getLogBadge(log.type)}
                    <span className="text-sm font-bold text-foreground line-clamp-1">
                      {log.action}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ko })}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-medium">
                  {log.ipAddress && (
                    <div className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 opacity-70" />
                      <span>{log.ipAddress}</span>
                    </div>
                  )}
                  {log.userAgent && (
                    <span className="truncate max-w-[200px] hidden sm:inline">
                      {log.userAgent.split(' ')[0]} {/* Simplified UA */}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-center text-[10px] text-muted-foreground pt-4">
        * 최근 20개의 활동 내역만 표시됩니다.
      </p>
    </div>
  );
}
