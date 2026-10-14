'use client';

import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  useAddSubManager,
  useBoardPermissions,
  useRemoveSubManager,
  useUpdateBoardSettings,
} from '@/hooks/queries/use-board-community-queries';
import { useBoard } from '@/hooks/queries/use-board-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { toast } from '@/lib/toast';
import { BOARD_SUB_MANAGER_LIMIT } from '@community/shared-types';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

/**
 * 게시판 관리 (매니저·사이트 관리자): 설명 수정, 부매니저 지정/해제.
 * 글/댓글 삭제와 공지 지정은 게시판 화면의 각 글에서 한다
 */
export default function BoardManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const { authChecked } = useAuthStore();
  const { data: board } = useBoard(slug);
  const { managers, canManage } = useBoardPermissions(slug);
  // 고치기 전에는 게시판의 현재 설명을 보여준다 (null = 아직 손대지 않음)
  const [editedDescription, setDescription] = useState<string | null>(null);
  const [newSubManager, setNewSubManager] = useState('');
  const updateSettings = useUpdateBoardSettings(slug);
  const addSubManager = useAddSubManager(slug);
  const removeSubManager = useRemoveSubManager(slug);

  if (!board || !authChecked) return <PageContainer maxWidth="md" className="py-8" />;
  if (!canManage) {
    return (
      <PageContainer maxWidth="md" className="py-8">
        <p className="text-muted-foreground">게시판 매니저만 볼 수 있는 화면입니다.</p>
      </PageContainer>
    );
  }

  const description = editedDescription ?? board.description ?? '';
  const manager = managers.find((m) => m.role === 'manager');
  const subManagers = managers.filter((m) => m.role === 'sub_manager');

  return (
    <PageContainer maxWidth="md" className="py-8 space-y-10">
      <div>
        <Link href={`/board/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> {board.name}
        </Link>
        <h1 className="text-2xl font-bold">게시판 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          매니저와 부매니저는 이 게시판의 글·댓글을 삭제하고 글을 공지로 올릴 수 있습니다. 각 글의 메뉴에서 할 수 있습니다.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">게시판 설명</h2>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        <Button
          size="sm"
          disabled={updateSettings.isPending || description === (board.description ?? '')}
          onClick={() => updateSettings.mutate({ description: description.trim() }, { onSuccess: () => toast.success('설명을 바꿨습니다.') })}
        >
          저장
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">관리자</h2>
        <label className="flex items-center justify-between gap-4 rounded-xl border p-3 text-sm">
          <span>
            게시판 화면에 매니저·부매니저 이름 표시
            <span className="block text-xs text-muted-foreground">끄면 방문자에게 관리자 이름이 보이지 않습니다. 관리 권한은 그대로입니다.</span>
          </span>
          <Switch
            checked={board.showManagers !== false}
            disabled={updateSettings.isPending}
            onCheckedChange={(checked) =>
              updateSettings.mutate({ showManagers: checked }, { onSuccess: () => toast.success(checked ? '관리자 이름을 표시합니다.' : '관리자 이름을 숨깁니다.') })
            }
          />
        </label>
        <p className="text-sm">
          매니저 <span className="font-medium">{manager?.name ?? '없음'}</span>
          <span className="text-xs text-muted-foreground"> (매니저 변경은 사이트 관리자에게 요청해주세요)</span>
        </p>
        <div>
          <p className="text-sm mb-2">
            부매니저 {subManagers.length}/{BOARD_SUB_MANAGER_LIMIT}
          </p>
          {subManagers.length > 0 && (
            <ul className="divide-y border rounded-xl mb-3">
              {subManagers.map((m) => (
                <li key={m.userId} className="flex items-center justify-between p-3 text-sm">
                  <span>{m.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removeSubManager.isPending}
                    onClick={() => {
                      if (!confirm(`${m.name} 님을 부매니저에서 해제할까요?`)) return;
                      removeSubManager.mutate(m.userId, { onSuccess: () => toast.success('해제했습니다.') });
                    }}
                  >
                    해제
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {subManagers.length < BOARD_SUB_MANAGER_LIMIT && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newSubManager.trim();
                if (!name) return;
                addSubManager.mutate(name, {
                  onSuccess: () => {
                    toast.success(`${name} 님을 부매니저로 지정했습니다.`);
                    setNewSubManager('');
                  },
                });
              }}
            >
              <Input value={newSubManager} onChange={(e) => setNewSubManager(e.target.value)} placeholder="부매니저로 지정할 회원 닉네임" />
              <Button type="submit" disabled={addSubManager.isPending}>지정</Button>
            </form>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
