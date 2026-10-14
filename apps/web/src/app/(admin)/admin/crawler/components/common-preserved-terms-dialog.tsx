'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookLock } from 'lucide-react';
import { crawlerApi } from '@/lib/api/crawler';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PreservedTermsField } from './preserved-terms-field';

/**
 * 모든 카드에 공통으로 적용되는 보존 단어 설정.
 * 수집 시 카드별 보존 단어와 합쳐지며, 같은 단어가 양쪽에 있으면 카드 쪽 뜻이 우선한다.
 */
export function CommonPreservedTermsDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['crawler-settings'],
    queryFn: crawlerApi.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: crawlerApi.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['crawler-settings'], updated);
      toast.success('공통 보존 단어가 저장되었습니다.');
      setOpen(false);
    },
    onError: () => toast.error('공통 보존 단어 저장에 실패했습니다.'),
  });

  const handleOpenChange = (next: boolean) => {
    // 열 때마다 저장된 값으로 초기화 (저장하지 않고 닫은 입력은 버린다)
    if (next) setValue(settings?.preservedTerms ?? '');
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="cursor-pointer">
          <BookLock className="h-4 w-4 mr-2" />
          공통 보존 단어
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>공통 보존 단어</DialogTitle>
          <DialogDescription>
            모든 갤러리 카드에 공통으로 적용됩니다. 각 카드의 보존 단어와 합쳐지며, 같은 단어가 양쪽에 있으면 카드에 적은 뜻이 우선합니다.
          </DialogDescription>
        </DialogHeader>
        <PreservedTermsField
          id="common-preservedTerms"
          rows={5}
          placeholder="예: ㄹㅇ, 꼬라박다=크게 손해 보다"
          value={value}
          onChange={setValue}
          scopeHint="모든 카드에 적용됩니다. 저장 후 다음 수집부터 적용됩니다."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
            취소
          </Button>
          <Button
            onClick={() => updateMutation.mutate({ preservedTerms: value.trim() || null })}
            disabled={updateMutation.isPending}
            className="cursor-pointer"
          >
            {updateMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
