'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Heart, MessageSquare, Reply, Info, Check, X, Trash2 } from 'lucide-react';
import { 
  useNotifications, 
  useUnreadNotificationCount, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead,
  useRemoveNotification,
  useRemoveAllNotifications,
  useNotificationSSE
} from '@/hooks/queries/use-notification-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter, usePathname } from 'next/navigation';

export function NotificationBell() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Enable real-time notifications
  useNotificationSSE(!!user);

  const { data: notifications = [] } = useNotifications();
  const { data: unreadData } = useUnreadNotificationCount({ enabled: !!user });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const removeMutation = useRemoveNotification();
  const removeAllMutation = useRemoveAllNotifications();

  const unreadCount = unreadData?.count || 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    setIsOpen(false);

    if (notification.link) {
      const isSamePage = notification.link.startsWith(pathname);
      
      router.push(notification.link);

      // If already on the same page, manually trigger scroll logic via custom event
      if (isSamePage && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-click', { 
          detail: { link: notification.link } 
        }));
      }
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeMutation.mutate(id);
  };

  const handleRemoveAll = () => {
    if (confirm('모든 알림을 삭제하시겠습니까?')) {
      removeAllMutation.mutate();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return <Heart className="w-4 h-4 text-rose-500 fill-rose-500/10" />;
      case 'COMMENT': return <MessageSquare className="w-4 h-4 text-blue-500 fill-blue-500/10" />;
      case 'REPLY': return <Reply className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full hover:bg-muted transition-all focus:outline-none active:scale-95 group cursor-pointer"
      >
        <Bell className={cn(
          "w-5 h-5 transition-transform group-hover:rotate-12", 
          unreadCount > 0 
            ? "text-primary" 
            : "text-muted-foreground"
        )} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white border-2 border-background shadow-sm transform translate-x-1/4 -translate-y-1/4">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-4 right-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 sm:w-80 bg-background border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[520px] animate-in fade-in zoom-in-95 duration-200 origin-top-right border-border/50">
          <div className="px-5 py-4 border-b flex justify-between items-center bg-muted/30 backdrop-blur-md">
            <h3 className="font-bold text-sm tracking-tight">알림 내역</h3>
            <div className="flex gap-4">
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  모두 읽음
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={handleRemoveAll}
                  className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  전체 삭제
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {notifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="inline-flex p-3 rounded-full bg-muted/50">
                  <Bell className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">새로운 알림이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "group p-4 pr-12 cursor-pointer transition-all hover:bg-muted/40 relative flex gap-3.5 items-start",
                      !n.isRead ? "bg-primary/[0.03]" : "opacity-70 grayscale-[0.3]"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 shrink-0 p-2 rounded-xl bg-muted/50 group-hover:bg-background transition-colors shadow-sm",
                      !n.isRead && "bg-background border border-primary/10 shadow-primary/5"
                    )}>
                      {getIcon(n.type)}
                    </div>
                    <div className="space-y-1.5 overflow-hidden flex-1">
                      <p className={cn("text-[13px] leading-[1.5]", !n.isRead ? "font-semibold text-foreground" : "text-muted-foreground font-medium")}>
                        {n.content}
                      </p>
                      <div className="flex items-center gap-2">
                         <span className="text-[11px] text-muted-foreground/80 font-medium">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ko })}
                        </span>
                        {!n.isRead && <span className="w-1 h-1 rounded-full bg-primary" />}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDelete(e, n.id)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 transition-all text-muted-foreground/50 cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
