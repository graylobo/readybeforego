'use client';

import { useState, useEffect } from 'react';
import { useSendMessage } from '@/hooks/queries/use-message-queries';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SendMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  receiverId?: string;
  receiverName?: string;
}

export function SendMessageDialog({
  isOpen,
  onClose,
  receiverId: initialReceiverId,
  receiverName: initialReceiverName,
}: SendMessageDialogProps) {
  const [receiverId, setReceiverId] = useState(initialReceiverId || '');
  const [content, setContent] = useState('');
  const sendMessageMutation = useSendMessage();

  useEffect(() => {
    if (isOpen) {
      setReceiverId(initialReceiverId || '');
      setContent('');
    }
  }, [isOpen, initialReceiverId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId || !content) return;

    sendMessageMutation.mutate(
      { receiverId, content },
      {
        onSuccess: () => {
          alert('쪽지를 보냈습니다.');
          onClose();
        },
        onError: (error: any) => {
          alert(error.response?.data?.message || '쪽지 발송에 실패했습니다.');
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">쪽지 보내기</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="receiverId">받는 사람</Label>
            <Input
              id="receiverId"
              placeholder="상대방 ID를 입력하세요"
              value={initialReceiverName || receiverId}
              onChange={(e) => !initialReceiverId && setReceiverId(e.target.value)}
              disabled={!!initialReceiverId}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">내용</Label>
            <Textarea
              id="content"
              placeholder="최대 5,000자 까지 작성 가능합니다."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] rounded-xl resize-none"
              maxLength={5000}
            />
            <div className="text-[11px] text-right text-muted-foreground">
              {content.length} / 5,000
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={sendMessageMutation.isPending || !receiverId || !content}
              className="flex-1 rounded-xl shadow-lg shadow-primary/20"
            >
              {sendMessageMutation.isPending ? '보내는 중...' : '보내기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
