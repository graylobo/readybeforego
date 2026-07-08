'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserModerationLogs } from '@/hooks/queries/use-admin-queries';
import { format } from 'date-fns';
import { Loader2, AlertCircle, Clock, Ban, Unlock, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ModerationHistoryDialogProps {
  userId: string | null;
  userName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ModerationHistoryDialog({ userId, userName, isOpen, onClose }: ModerationHistoryDialogProps) {
  const { data: logs, isLoading } = useUserModerationLogs(userId || '');

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'WARNING':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'SUSPENSION':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'BAN':
        return <Ban className="w-4 h-4 text-red-500" />;
      case 'REACTIVATE':
        return <Unlock className="w-4 h-4 text-green-500" />;
      default:
        return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLogBadge = (type: string) => {
    switch (type) {
      case 'WARNING':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">경고</Badge>;
      case 'SUSPENSION':
        return <Badge variant="outline" className="text-orange-500 border-orange-500">정지</Badge>;
      case 'BAN':
        return <Badge variant="outline" className="text-red-500 border-red-500">영구 정지</Badge>;
      case 'REACTIVATE':
        return <Badge variant="outline" className="text-green-500 border-green-500">해제</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{userName}님의 제재 히스토리</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">기록을 불러오는 중...</p>
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">제재 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {logs.map((log) => (
                <div key={log.id} className="relative flex items-start gap-4 pb-4 last:pb-0">
                  <div className="absolute left-5 -translate-x-1/2 mt-1.5 w-3 h-3 rounded-full bg-background border-2 border-primary ring-4 ring-background" />
                  
                  <div className="flex-1 ml-10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getLogIcon(log.type)}
                        {getLogBadge(log.type)}
                        {log.durationDays && (
                          <span className="text-xs font-bold text-muted-foreground">({log.durationDays}일)</span>
                        )}
                      </div>
                      <time className="text-[11px] font-bold text-muted-foreground">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
                      </time>
                    </div>
                    
                    <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
                      <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{log.reason}</p>
                    </div>

                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] font-bold text-muted-foreground/60">처분 관리자:</span>
                      <div className="flex items-center gap-1.5">
                        <Avatar className="w-4 h-4">
                          <AvatarImage src={log.admin?.picture || ''} />
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">{log.admin?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] font-black text-foreground/80">{log.admin?.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
