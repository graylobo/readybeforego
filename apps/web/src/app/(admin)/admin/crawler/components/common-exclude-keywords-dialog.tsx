'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
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
import { ExcludeKeywordsField } from './exclude-keywords-field';

/**
 * 모든 카드에 공통으로 적용되는 제외 키워드 설정.
 * 수집 시 카드별 제외 키워드와 합쳐서, 둘 중 하나라도 제목이나 본문에 들어 있는 글은 수집하지 않는다.
 */
export function CommonExcludeKeywordsDialog() {
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
      toast.success('공통 제외 키워드가 저장되었습니다.');
      setOpen(false);
    },
    onError: () => toast.error('공통 제외 키워드 저장에 실패했습니다.'),
  });

  const handleOpenChange = (next: boolean) => {
    // 열 때마다 저장된 값으로 초기화 (저장하지 않고 닫은 입력은 버린다)
    if (next) setValue(settings?.excludeKeywords ?? '');
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="cursor-pointer">
          <Ban className="h-4 w-4 mr-2" />
          공통 제외 키워드
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>공통 제외 키워드</DialogTitle>
          <DialogDescription>
            모든 갤러리 카드에 공통으로 적용됩니다. 각 카드의 제외 키워드와 합쳐서, 둘 중 하나라도 들어 있는 글은 수집하지 않습니다.
          </DialogDescription>
        </DialogHeader>
        <ExcludeKeywordsField
          id="common-excludeKeywords"
          rows={5}
          value={value}
          onChange={setValue}
          scopeHint="모든 카드에 적용됩니다. 저장 후 다음 수집부터 적용됩니다."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
            취소
          </Button>
          <Button
            onClick={() => updateMutation.mutate({ excludeKeywords: value.trim() || null })}
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
