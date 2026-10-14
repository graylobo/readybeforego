'use client';

import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBoardRequest, useMyBoardRequests } from '@/hooks/queries/use-board-community-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { toast } from '@/lib/toast';
import { formatSiteDate } from '@/lib/utils/date';
import { CreateBoardRequestSchema } from '@community/shared-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const STATUS_LABEL = { pending: '검토 중', approved: '승인', rejected: '반려' } as const;

/**
 * 게시판 개설 신청. 회원 누구나 신청하고, 관리자가 승인하면 신청자가 매니저가 된다
 */
export default function BoardRequestPage() {
  const router = useRouter();
  const { user, authChecked } = useAuthStore();
  const [form, setForm] = useState({ slug: '', name: '', description: '', reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createRequest = useCreateBoardRequest();
  const { data: myRequests = [] } = useMyBoardRequests(!!user);

  useEffect(() => {
    if (authChecked && !user) router.replace('/login?redirect=/boards/request');
  }, [authChecked, user, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateBoardRequestSchema.safeParse({
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      reason: form.reason.trim() || undefined,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    createRequest.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('개설 신청이 접수되었습니다. 검토 결과는 알림으로 알려드립니다.');
        setForm({ slug: '', name: '', description: '', reason: '' });
      },
    });
  };

  if (!user) return null;
  const hasPending = myRequests.some((r) => r.status === 'pending');

  return (
    <PageContainer maxWidth="md" className="py-8">
      <h1 className="text-2xl font-bold mb-1">게시판 개설 신청</h1>
      <p className="text-sm text-muted-foreground mb-6">
        관리자가 확인한 뒤 개설되며, 신청하신 분이 게시판 매니저가 됩니다. 매니저는 부매니저를 최대 3명까지 지정할 수 있습니다.
      </p>

      {hasPending ? (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm mb-8">검토 중인 신청이 있습니다. 결과가 나온 뒤 다시 신청할 수 있습니다.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 mb-10">
          <Field label="게시판 이름" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 스타크래프트 게시판" maxLength={100} />
          </Field>
          <Field label="게시판 주소" error={errors.slug} hint="영문 소문자, 숫자, 하이픈(-)만 쓸 수 있습니다.">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground shrink-0">/board/</span>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="starcraft" maxLength={50} />
            </div>
          </Field>
          <Field label="게시판 설명 (선택)" error={errors.description}>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
          </Field>
          <Field label="신청 사유 (선택)" error={errors.reason}>
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={4} maxLength={1000} />
          </Field>
          <Button type="submit" disabled={createRequest.isPending}>
            {createRequest.isPending ? '신청 중...' : '신청하기'}
          </Button>
        </form>
      )}

      <h2 className="text-sm font-semibold text-muted-foreground mb-3">내 신청 내역</h2>
      {myRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 신청한 게시판이 없습니다.</p>
      ) : (
        <ul className="divide-y border rounded-xl">
          {myRequests.map((request) => (
            <li key={request.id} className="p-4 text-sm flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">
                  {request.name} <span className="text-muted-foreground">/board/{request.slug}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{formatSiteDate(request.createdAt, 'yyyy.MM.dd HH:mm')} 신청</div>
                {request.status === 'rejected' && request.rejectReason && (
                  <div className="text-xs text-destructive mt-1">반려 사유: {request.rejectReason}</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className={request.status === 'rejected' ? 'text-destructive' : request.status === 'approved' ? 'text-primary' : 'text-muted-foreground'}>
                  {STATUS_LABEL[request.status]}
                </span>
                {request.status === 'approved' && (
                  <div>
                    <Link href={`/board/${request.slug}`} className="text-xs underline">게시판 가기</Link>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
