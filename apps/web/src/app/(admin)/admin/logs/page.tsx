'use client';

import { useState } from 'react';
import { useAdminLogs } from '@/hooks/queries/use-log-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  LogIn, 
  FileText, 
  MessageSquare, 
  Heart, 
  UserCog, 
  Trash2, 
  Clock,
  Search,
  User as UserIcon,
  Monitor,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { CommonPagination } from '@/components/common/common-pagination';

export default function AdminLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 50;
  
  const { data, isLoading } = useAdminLogs(page, limit);
  
  const logs = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'LOGIN': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">로그인</Badge>;
      case 'POST_CREATE': return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">글 작성</Badge>;
      case 'COMMENT_CREATE': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">댓글</Badge>;
      case 'LIKE': return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">추천</Badge>;
      case 'UPDATE_PROFILE': return <Badge variant="outline" className="text-purple-600 bg-purple-50 border-purple-200">설정 변경</Badge>;
      case 'DELETE_POST': return <Badge variant="outline" className="text-destructive bg-destructive/5 border-destructive/20">삭제</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto max-md:p-4">
      <div className="mb-8 flex justify-between items-end max-md:flex-col max-md:items-start max-md:gap-4">
        <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
                <h1 className="text-2xl font-bold">사용자 활동 로그</h1>
                <p className="text-sm text-muted-foreground">사이트에서 발생하는 모든 주요 활동을 모니터링합니다.</p>
            </div>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[180px]">일시</TableHead>
                <TableHead className="w-[150px]">사용자</TableHead>
                <TableHead className="w-[120px]">타입</TableHead>
                <TableHead>활동 내용</TableHead>
                <TableHead className="w-[150px]">IP 주소</TableHead>
                <TableHead className="w-[100px]">기기 정보</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    로그 내역이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3 h-3 text-muted-foreground" />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold">{log.user?.name || '탈퇴 사용자'}</span>
                            <span className="text-[10px] text-muted-foreground truncate w-24">{log.user?.email || '-'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getLogIcon(log.type)}
                        {getTypeBadge(log.type)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {log.action}
                      {log.targetId && (
                        <span className="ml-2 text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                          ID: {log.targetId.substring(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.ipAddress || '-'}
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center justify-center" title={log.userAgent}>
                            <Monitor className="w-4 h-4 text-muted-foreground opacity-50 cursor-help" />
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <CommonPagination
             currentPage={page}
             totalPages={totalPages}
             onPageChange={(p) => setPage(p)}
          />
        </div>
      )}
    </div>
  );
}
