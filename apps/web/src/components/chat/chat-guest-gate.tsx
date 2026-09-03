'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClaimGuestNicknameDto, ClaimGuestNicknameSchema } from '@community/shared-types';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { guestNicknameErrorMessage, useClaimGuestNickname } from '@/hooks/queries/use-chat-queries';

export function ChatGuestGate() {
  const claim = useClaimGuestNickname();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ClaimGuestNicknameDto>({
    resolver: zodResolver(ClaimGuestNicknameSchema),
    defaultValues: { nickname: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await claim.mutateAsync(values.nickname);
    } catch (error) {
      const message = guestNicknameErrorMessage(error);
      setSubmitError(message);
      form.setError('nickname', { message });
    }
  });

  const fieldError = form.formState.errors.nickname?.message || submitError;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-md px-5">
      <form onSubmit={onSubmit} className="w-full max-w-[240px] flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-full border border-primary/40 text-primary flex items-center justify-center mb-4">
          <UserRound className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-foreground">실시간 채팅</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">실시간 채팅에 참여하세요</p>
        <Input
          autoComplete="nickname"
          placeholder="닉네임 (2~12자, 공백 불가)"
          aria-invalid={!!fieldError}
          className="text-center"
          {...form.register('nickname')}
        />
        {fieldError && (
          <p className="mt-2 text-xs text-destructive w-full text-left">{fieldError}</p>
        )}
        <Button type="submit" className="w-full mt-3" disabled={claim.isPending}>
          {claim.isPending ? '확인 중...' : '입장하기'}
        </Button>
        <Link
          href="/login"
          className="mt-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer underline-offset-4 hover:underline"
        >
          고정닉 가입
        </Link>
      </form>
    </div>
  );
}
