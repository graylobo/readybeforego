'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useEmoticonPacks, useAdminUpdateEmoticonStatus, useDeleteEmoticonPack, useAdminUpdateEmoticonPrice, useAdminForceDeletePack, useRestoreEmoticonPack } from '@/hooks/queries/use-emoticon-queries';
import { emoticonApi } from '@/lib/api/emoticon';
import { EmoticonPack } from '@community/shared-types';
import { CheckCircle, XCircle, Clock, Search, Trash2, Eye, ShoppingBag, AlertTriangle, Play } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { toast } from '@/lib/toast';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'discontinued';

function useAdminEmoticonPacks(params: { status?: string; q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin-emoticons', params],
    queryFn: () => emoticonApi.adminGetAllPacks(params),
    placeholderData: keepPreviousData,
  });
}

const STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: '검토중', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/40', icon: <Clock className="w-3 h-3" /> },
  approved: { label: '승인됨', className: 'bg-green-500/20 text-green-600 border-green-500/40', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: '거절됨', className: 'bg-red-500/20 text-red-600 border-red-500/40', icon: <XCircle className="w-3 h-3" /> },
  discontinued: { label: '판매중지됨', className: 'bg-muted text-muted-foreground border-transparent', icon: <Trash2 className="w-3 h-3" /> },
};

export default function AdminEmoticonsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [selectedPack, setSelectedPack] = useState<EmoticonPack | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const [editPrice, setEditPrice] = useState<number | null>(null);

  const { data, isLoading } = useAdminEmoticonPacks({
    status: statusFilter,
    q: searchInput || undefined,
    limit: 50,
  });

  const updateStatusMutation = useAdminUpdateEmoticonStatus();
  const updatePriceMutation = useAdminUpdateEmoticonPrice();
  const deleteMutation = useDeleteEmoticonPack();
  const forceDeleteMutation = useAdminForceDeletePack();
  const restoreMutation = useRestoreEmoticonPack();

  const packs = data?.items ?? [];

  const handleApprove = (pack: EmoticonPack) => {
    updateStatusMutation.mutate({ id: pack.id, status: 'approved' }, {
      onSuccess: () => {
        if (selectedPack?.id === pack.id) {
          setSelectedPack(null);
        }
      }
    });
  };

  const handleDelete = (pack: EmoticonPack) => {
    if (!confirm(`"${pack.title}" 팩을 삭제하시겠습니까? (구매자의 보유 목록에는 유지됩니다)`)) return;
    deleteMutation.mutate(pack.id);
  };

  const handleRestore = (pack: EmoticonPack) => {
    if (!confirm(`"${pack.title}" 이모티콘의 판매를 다시 시작하시겠습니까?`)) return;
    restoreMutation.mutate(pack.id);
  };

  const handleForceDelete = (pack: EmoticonPack) => {
    const check = confirm(
      `[경고] "${pack.title}" 팩을 '완전 삭제'하시겠습니까?\n\n` +
      `- 모든 구매자의 보유 목록에서 즉시 사라집니다.\n` +
      `- 모든 구매자에게 포인트(${pack.price}P)가 환불됩니다.\n` +
      `- 제작자에게 지급된 포인트가 회수됩니다.\n\n` +
      `이 작업은 되돌릴 수 없습니다.`
    );
    if (!check) return;
    
    forceDeleteMutation.mutate(pack.id, {
        onSuccess: () => setSelectedPack(null)
    });
  };

  const handleReject = () => {
    if (!selectedPack) return;
    updateStatusMutation.mutate({
      id: selectedPack.id,
      status: 'rejected',
      rejectionReason: rejectReason.trim() || undefined,
    }, {
      onSuccess: () => {
        setConfirmReject(false);
        setSelectedPack(null);
        setRejectReason('');
      }
    });
  };

  const handleUpdatePrice = () => {
    if (!selectedPack || editPrice === null) return;
    updatePriceMutation.mutate({
        id: selectedPack.id,
        price: editPrice
    }, {
        onSuccess: () => {
            setSelectedPack(prev => prev ? { ...prev, price: editPrice } : null);
            setEditPrice(null);
        }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground">이모티콘 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">유저가 등록한 이모티콘 팩을 검토하고 승인합니다.</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'approved', 'rejected', 'discontinued'] as StatusFilter[]).map(status => {
            const s = STATUS_BADGE[status];
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                  statusFilter === status
                    ? s.className + ' border-current'
                    : 'border-border/50 text-muted-foreground hover:border-border'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="이모티콘 이름 검색..."
            className="pl-8 h-9 text-sm bg-muted/30 border-border/50 rounded-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : packs.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium">해당 상태의 이모티콘이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {packs.map(pack => {
              const st = (pack as any).deletedAt ? STATUS_BADGE.discontinued : (STATUS_BADGE[pack.status] ?? STATUS_BADGE.pending);
              return (
                <div key={pack.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted/30 shrink-0">
                    <img src={pack.thumbnailUrl} alt={pack.title} className="w-full h-full object-cover" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm truncate">{pack.title}</p>
                      <Badge variant="outline" className={`text-[10px] ${st.className} flex items-center gap-0.5`}>
                        {st.icon}{st.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      제작: {(pack.author as any)?.name ?? '?'} · {pack.price}P · 이모티콘 {pack.emoticons?.length ?? 0}개
                    </p>
                    {pack.rejectionReason && (
                      <p className="text-xs text-red-500 mt-0.5">거절 사유: {pack.rejectionReason}</p>
                    )}
                  </div>

                  {/* Sales */}
                  <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {pack.salesCount}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setSelectedPack(pack)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    {pack.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(pack)}
                          disabled={updateStatusMutation.isPending}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs border-red-500/50 text-red-500 hover:bg-red-500/10"
                          onClick={() => { setSelectedPack(pack); setConfirmReject(true); }}
                        >
                          거절
                        </Button>
                      </>
                    )}

                    {pack.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                        onClick={() => updateStatusMutation.mutate({ id: pack.id, status: 'pending' })}
                      >
                        검토중으로
                      </Button>
                    )}

                    {pack.status === 'rejected' && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(pack)}
                          disabled={updateStatusMutation.isPending}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                          onClick={() => updateStatusMutation.mutate({ id: pack.id, status: 'pending' })}
                        >
                          검토중으로
                        </Button>
                      </>
                    )}

                    {(pack as any).deletedAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs border-primary/50 text-primary hover:bg-primary/5 cursor-pointer"
                        onClick={() => handleRestore(pack)}
                        disabled={restoreMutation.isPending}
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        판매 재개
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(pack)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedPack && !confirmReject} onOpenChange={open => !open && setSelectedPack(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPack && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-black">{selectedPack.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex gap-4">
                  <img src={selectedPack.thumbnailUrl} alt={selectedPack.title} className="w-24 h-24 rounded-xl object-cover" />
                  <div className="text-sm space-y-2 flex-1">
                    <p><span className="text-muted-foreground">작성자:</span> {(selectedPack.author as any)?.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">가격:</span>
                      {editPrice !== null ? (
                        <div className="flex items-center gap-2">
                            <Input 
                                type="number" 
                                value={editPrice} 
                                onChange={e => setEditPrice(Number(e.target.value))}
                                className="w-24 h-8 text-xs font-bold"
                            />
                            <Button size="sm" className="h-8 px-2" onClick={handleUpdatePrice} disabled={updatePriceMutation.isPending}>저장</Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditPrice(null)}>취소</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                           <span className="font-bold">{selectedPack.price}P</span>
                           <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setEditPrice(selectedPack.price)}>수정</Button>
                        </div>
                      )}
                    </div>
                    <p><span className="text-muted-foreground">판매수:</span> {selectedPack.salesCount}</p>
                    {(selectedPack as any).deletedAt && (
                      <p className="text-red-500 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        판매 중지된 상품입니다.
                      </p>
                    )}
                    {selectedPack.description && (
                      <p><span className="text-muted-foreground">설명:</span> {selectedPack.description}</p>
                    )}
                  </div>
                </div>
                {selectedPack.emoticons && (
                  <div className="flex flex-wrap gap-2">
                    {selectedPack.emoticons.map(e => (
                      <img
                        key={e.id}
                        src={e.url}
                        alt={e.name ?? ''}
                        className="w-16 h-16 object-contain rounded-lg border border-border/50 bg-muted/20"
                      />
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <div className="flex gap-2 mr-auto">
                    <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleForceDelete(selectedPack)}
                        disabled={forceDeleteMutation.isPending}
                        className="gap-1.5"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        완전 삭제 (환불)
                    </Button>
                    {(selectedPack as any).deletedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/50 text-primary hover:bg-primary/5 cursor-pointer"
                        onClick={() => handleRestore(selectedPack)}
                        disabled={restoreMutation.isPending}
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        판매 재개
                      </Button>
                    )}
                </div>
                <div className="flex gap-2">
                    {selectedPack.status !== 'approved' && (
                    <Button onClick={() => handleApprove(selectedPack)} className="bg-green-600 hover:bg-green-700 text-white">승인</Button>
                    )}
                    {selectedPack.status !== 'pending' && (
                    <Button variant="outline" className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10" onClick={() => updateStatusMutation.mutate({ id: selectedPack.id, status: 'pending' }, { onSuccess: () => setSelectedPack(null) })}>검토중으로</Button>
                    )}
                    {selectedPack.status !== 'rejected' && (
                    <Button variant="outline" className="border-red-500/50 text-red-500" onClick={() => setConfirmReject(true)}>거절</Button>
                    )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={confirmReject} onOpenChange={open => { if (!open) { setConfirmReject(false); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이모티콘 거절</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">거절 사유를 입력해주세요. (선택)</p>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="거절 사유..."
              className="resize-none h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReject(false)}>취소</Button>
            <Button
              onClick={handleReject}
              disabled={updateStatusMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              거절 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
