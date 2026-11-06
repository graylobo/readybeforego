'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GrantPointsSchema } from '@community/shared-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useGrantPoints } from '@/hooks/queries/use-admin-queries';
import { toast } from '@/lib/toast';

interface GrantPointsDialogProps {
  target: { id: string; name: string } | null;
  onClose: () => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

/** 시스템 관리자가 회원에게 포인트 지급 (사용 가능 포인트, 받은 회원에게 알림이 간다) */
export function GrantPointsDialog({ target, onClose }: GrantPointsDialogProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const grantMutation = useGrantPoints();

  const close = () => {
    setAmount('');
    setReason('');
    onClose();
  };

  const handleSubmit = () => {
    if (!target) return;
    const parsed = GrantPointsSchema.safeParse({ amount: Number(amount), reason });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.');
      return;
    }
    const { amount: points, reason: trimmedReason } = parsed.data;
    if (!confirm(`${target.name}님에게 ${points.toLocaleString()}포인트를 지급할까요?`)) return;

    grantMutation.mutate(
      { id: target.id, amount: points, reason: trimmedReason },
      {
        onSuccess: (data) => {
          toast.success(
            `${points.toLocaleString()}포인트를 지급했습니다. (보유 ${data.availablePoints.toLocaleString()}P)`,
          );
          close();
        },
      },
    );
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>포인트 지급</DialogTitle>
          <DialogDescription>
            {target?.name}님에게 사용 가능 포인트를 지급합니다. 레벨(누적 포인트)은 바뀌지 않으며, 받은 회원에게 알림이 갑니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="grant-amount" className="text-sm font-medium">
              지급 포인트
            </label>
            <Input
              id="grant-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={1_000_000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 1000"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 cursor-pointer text-xs"
                  onClick={() => setAmount(String(value))}
                >
                  {value.toLocaleString()}P
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="grant-reason" className="text-sm font-medium">
              지급 사유 <span className="font-normal text-muted-foreground">(회원 포인트 내역과 알림에 보입니다)</span>
            </label>
            <Textarea
              id="grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="예: 10월 이벤트 당첨"
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={close}>
            취소
          </Button>
          <Button className="cursor-pointer" disabled={grantMutation.isPending} onClick={handleSubmit}>
            {grantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            지급
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
