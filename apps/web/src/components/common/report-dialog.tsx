'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCreateReport } from '@/hooks/queries/use-report-queries';
import { ReportTargetType } from '@community/shared-types';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
}

export function ReportDialog({ isOpen, onClose, targetType, targetId }: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const createReport = useCreateReport();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('신고사유를 입력해주세요.');
      return;
    }

    createReport.mutate(
      { targetType, targetId, reason },
      {
        onSuccess: () => {
          toast.success('신고가 접수되었습니다.');
          setReason('');
          onClose();
        },
        onError: () => {
          toast.error('신고 접수 중 오류가 발생했습니다.');
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <Form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>신고하기</DialogTitle>
            <DialogDescription>
              부적절한 내용이 포함된 {targetType === 'POST' ? '게시글' : '댓글'}인가요? 신고 사유를 상세하게 말씀해주세요. 관리자가 검토 후 조치하겠습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="여기에 신고 사유를 입력하세요..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none min-h-[120px]"
              maxLength={1000}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={createReport.isPending || !reason.trim()}>
              {createReport.isPending ? '접수 중...' : '신고 접수'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper for the native form tag to prevent TS issues with radix UI forms
function Form(props: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} />;
}
