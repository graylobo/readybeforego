'use client';

import { useState } from 'react';
import { 
  useReceivedMessages, 
  useSentMessages, 
  useDeleteMessage, 
  useSendMessage,
  useMessageDetail,
  messageKeys
} from '@/hooks/queries/use-message-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Inbox, 
  Send as SendIcon, 
  Trash2, 
  Plus, 
  Mail, 
  MailOpen, 
  ChevronRight,
  User,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { SendMessageDialog } from '@/components/messages/send-message-dialog';
import { UserProfilePopover } from '@/components/common/user-profile-popover';
import { PageContainer } from '@/components/layout/page-container';

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [page, setPage] = useState(1);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);

  const { data: receivedData, isLoading: isLoadingReceived } = useReceivedMessages(page);
  const { data: sentData, isLoading: isLoadingSent } = useSentMessages(page);
  const deleteMutation = useDeleteMessage();
  const queryClient = useQueryClient();

  const { data: detailData } = useMessageDetail(selectedMessageId);

  const messages = activeTab === 'inbox' ? receivedData?.items : sentData?.items;
  const isLoading = activeTab === 'inbox' ? isLoadingReceived : isLoadingSent;

  useEffect(() => {
    // detailData가 로드되었고, 현재 수신함 탭인 경우
    if (detailData && activeTab === 'inbox' && selectedMessageId === detailData.id) {
      // 목록에서 해당 메시지 찾기
      const messageInList = messages?.find((m: any) => m.message.id === detailData.id);
      
      // 목록에서는 아직 안읽음 상태인 경우에만 실행 (무한 루프 방지)
      if (messageInList && !messageInList.message.isRead) {
        // 1. 목록 캐시 즉시 업데이트 (New 아이콘 즉시 제거)
        queryClient.setQueryData(messageKeys.received(page), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item: any) => 
              item.message.id === detailData.id 
                ? { ...item, message: { ...item.message, isRead: true } }
                : item
            )
          };
        });

        // 2. 다른 관련 카운트들 무효화하여 서버와 동기화
        queryClient.invalidateQueries({ queryKey: messageKeys.unreadCount });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        // 종모양 카운트 명시적 무효화
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      }
    }
  }, [detailData, selectedMessageId, activeTab, queryClient, page, messages]);

  if (!user) return <div className="p-20 text-center">로그인이 필요합니다.</div>;

  const handleSendMessage = () => {
    setIsNewMessageOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (selectedMessageId === id) setSelectedMessageId(null);
      }
    });
  };

  const selectedMessage = messages?.find((m: any) => m.message.id === selectedMessageId);

  return (
    <PageContainer className="max-w-5xl h-[calc(100vh-14rem)] !py-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">쪽지함</h1>
        </div>
        <Button onClick={handleSendMessage} className="gap-2 rounded-full px-6 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> 쪽지 쓰기
        </Button>
      </div>

      <div className="bg-background border rounded-3xl overflow-hidden flex h-full">
        {/* Sidebar */}
        <div className={cn(
          "w-full md:w-80 border-r flex flex-col shrink-0 transition-all",
          selectedMessageId && "hidden md:flex"
        )}>
          <div className="flex border-b p-2 gap-2 bg-muted/30">
            <button 
              onClick={() => { setActiveTab('inbox'); setPage(1); setSelectedMessageId(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer",
                activeTab === 'inbox' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Inbox className="w-4 h-4" /> 수신함
            </button>
            <button 
              onClick={() => { setActiveTab('sent'); setPage(1); setSelectedMessageId(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer",
                activeTab === 'sent' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <SendIcon className="w-4 h-4" /> 발신함
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/40 scrollbar-hide">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
              ))
            ) : messages?.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">쪽지가 없습니다.</p>
              </div>
            ) : (
              messages?.map((m: any) => (
                <div 
                  key={m.message.id}
                  onClick={() => setSelectedMessageId(m.message.id)}
                  className={cn(
                    "p-5 cursor-pointer transition-all hover:bg-muted/30 relative flex gap-4 items-start group",
                    selectedMessageId === m.message.id ? "bg-muted/50" : "",
                    activeTab === 'inbox' && !m.message.isRead && "bg-primary/[0.03]"
                  )}
                >
                  <div className="shrink-0 p-2.5 rounded-2xl bg-muted/80">
                    {activeTab === 'inbox' ? (
                      m.message.isRead ? <MailOpen className="w-4 h-4 text-muted-foreground" /> : <Mail className="w-4 h-4 text-primary" />
                    ) : (
                      <SendIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <UserProfilePopover
                          userId={activeTab === 'inbox' ? m.sender?.id : m.receiver?.id}
                          userName={activeTab === 'inbox' ? m.sender?.name : m.receiver?.name}
                          userPicture={activeTab === 'inbox' ? m.sender?.picture : m.receiver?.picture}
                          className="text-sm font-bold truncate z-10"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          {activeTab === 'inbox' ? m.sender?.name : m.receiver?.name}
                        </UserProfilePopover>
                        {activeTab === 'inbox' && !m.message.isRead && (
                          <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm animate-pulse">N</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-tighter">
                        {format(new Date(m.message.createdAt), 'MM/dd HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate leading-relaxed">
                      {m.message.content}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 mt-1" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Content View */}
        <div className={cn(
          "flex-1 flex flex-col bg-muted/5 transition-all overflow-hidden",
          !selectedMessageId && "hidden md:flex justify-center items-center text-center p-12"
        )}>
          {selectedMessageId ? (
            <>
              <div className="p-6 border-b flex items-center justify-between bg-background/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden" 
                    onClick={() => setSelectedMessageId(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-2xl bg-primary/10">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black">
                        {activeTab === 'inbox' ? (selectedMessage as any)?.sender?.name : (selectedMessage as any)?.receiver?.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        {activeTab === 'inbox' ? 'SENDER' : 'RECEIVER'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-rose-500 rounded-xl"
                    onClick={() => handleDelete(selectedMessageId)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="text-xs text-muted-foreground flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full w-fit">
                    <Clock className="w-3 h-3" />
                    {selectedMessage && format(new Date(selectedMessage.message.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                  </div>
                  <div className="text-lg leading-relaxed text-foreground whitespace-pre-wrap font-medium">
                    {selectedMessage?.message.content}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 max-w-sm">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <h2 className="text-xl font-bold">대화를 선택하세요</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                좌측 목록에서 확인하고 싶은 쪽지를 클릭하세요.<br/>
              </p>
            </div>
          )}
        </div>
      </div>

      <SendMessageDialog
        isOpen={isNewMessageOpen}
        onClose={() => setIsNewMessageOpen(false)}
      />
    </PageContainer>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
