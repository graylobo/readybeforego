'use client';

import { SendMessageDialog } from '@/components/messages/send-message-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/lib/stores/auth.store';
import { cn } from '@/lib/utils';
import { Mail, Search, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface UserProfilePopoverProps {
  userId?: string | null;
  userName?: string | null;
  userPicture?: string | null;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function UserProfilePopover({
  userId,
  userName,
  userPicture,
  children,
  className,
  onClick,
}: UserProfilePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const { user: currentUser } = useAuthStore();
  const router = useRouter();

  if (!userId || !userName) return <>{children}</>;

  const isMe = currentUser?.id === userId;

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <span 
            className={cn('cursor-pointer hover:underline', className)}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(e);
            }}
          >
            {children}
          </span>
        </PopoverTrigger>
        <PopoverContent 
          className="w-fit min-w-[200px] p-0 overflow-hidden rounded-2xl shadow-2xl border-border/50"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="bg-muted/30 p-4 pb-3 flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
              {userPicture && <AvatarImage src={userPicture} alt={userName} />}
              <AvatarFallback className="bg-background text-lg font-bold">
                {userName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-sm font-black truncate">{userName}</span>
            </div>
          </div>

          <div className="p-3 border-t flex items-center justify-center gap-4">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11 rounded-full hover:bg-muted transition-all"
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/users/${userId}`);
                    }}
                  >
                    <User className="w-6 h-6 text-muted-foreground/80 hover:text-foreground transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-bold">
                  프로필
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11 rounded-full hover:bg-muted transition-all"
                    onClick={() => {
                      setIsOpen(false);
                      if (isMe) {
                        router.push('/messages');
                      } else {
                        setIsMessageOpen(true);
                      }
                    }}
                  >
                    <Mail className="w-6 h-6 text-muted-foreground/80 hover:text-foreground transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-bold">
                  {isMe ? '내 쪽지함' : '쪽지 보내기'}
                </TooltipContent>
              </Tooltip>

            </TooltipProvider>
          </div>
        </PopoverContent>
      </Popover>

      <SendMessageDialog
        isOpen={isMessageOpen}
        onClose={() => setIsMessageOpen(false)}
        receiverId={userId}
        receiverName={userName}
      />
    </>
  );
}
