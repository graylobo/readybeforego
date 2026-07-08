import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { emoticonApi, EmoticonPack } from '@/lib/api/emoticon';
import { CreateEmoticonPackDto, UpdateEmoticonPackDto } from '@community/shared-types';
import { toast } from '@/lib/toast';

export const emoticonKeys = {
  all: ['emoticons'] as const,
  lists: () => [...emoticonKeys.all, 'list'] as const,
  list: (params: object) => [...emoticonKeys.lists(), params] as const,
  detail: (id: string) => [...emoticonKeys.all, 'detail', id] as const,
  myPurchased: () => [...emoticonKeys.all, 'my', 'purchased'] as const,
  myCreated: () => [...emoticonKeys.all, 'my', 'created'] as const,
};

export function useEmoticonPacks(params?: { page?: number; limit?: number; q?: string; sortBy?: 'latest' | 'sales' }) {
  return useQuery({
    queryKey: emoticonKeys.list(params ?? {}),
    queryFn: () => emoticonApi.getEmoticonPacks(params),
    placeholderData: keepPreviousData,
  });
}

export function useEmoticonPack(id: string) {
  return useQuery({
    queryKey: emoticonKeys.detail(id),
    queryFn: () => emoticonApi.getEmoticonPack(id),
    enabled: !!id,
  });
}

export function useMyPurchasedPacks() {
  return useQuery({
    queryKey: emoticonKeys.myPurchased(),
    queryFn: () => emoticonApi.getMyPurchasedPacks({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * 이모티콘 픽커용: 구매한 팩 + 내가 제작한 승인된 팩을 합쳐서 반환
 * (내가 만든 이모티콘이 승인되면 바로 댓글/게시글에서 사용 가능)
 */
export function useMyAvailableEmoticonPacks() {
  const purchasedQuery = useMyPurchasedPacks();
  const createdQuery = useMyCreatedPacks();

  const packs = (() => {
    const purchasedPacks = (purchasedQuery.data?.items ?? [])
      .map((up: any) => up.pack ?? up)
      .filter(Boolean);

    const createdApprovedPacks = (createdQuery.data?.items ?? [])
      .filter((p: any) => p.status === 'approved');

    // Merge, deduplicate by id (own approved packs take priority)
    const seen = new Set<string>();
    return [...createdApprovedPacks, ...purchasedPacks].filter((p: any) => {
      if (!p?.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  })();

  return {
    packs,
    isLoading: purchasedQuery.isLoading || createdQuery.isLoading,
  };
}

export function useMyCreatedPacks() {
  return useQuery({
    queryKey: emoticonKeys.myCreated(),
    queryFn: () => emoticonApi.getMyCreatedPacks({ limit: 100 }),
  });
}

export function usePurchaseEmoticonPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emoticonApi.purchasePack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emoticonKeys.myPurchased() });
      queryClient.invalidateQueries({ queryKey: emoticonKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['points'] });
      toast.success('이모티콘 팩을 구매했습니다!');
    },
  });
}

export function useCreateEmoticonPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmoticonPackDto) => emoticonApi.createEmoticonPack(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emoticonKeys.myCreated() });
      toast.success('이모티콘 팩 등록 신청이 완료되었습니다. 관리자 승인 후 샵에 노출됩니다.');
    },
  });
}

export function useUpdateEmoticonPack() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateEmoticonPackDto }) => 
            emoticonApi.updateEmoticonPack(id, data),
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: emoticonKeys.all });
            toast.success('이모티콘 팩이 수정되었습니다.' + (updated.status === 'pending' ? ' 승인된 상품의 경우 관리자의 재검토 후 노출됩니다.' : ''));
        },
    });
}

export function useAdminUpdateEmoticonStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: 'approved' | 'rejected' | 'pending'; rejectionReason?: string }) =>
      emoticonApi.adminUpdateStatus(id, { status, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emoticonKeys.all });
      queryClient.invalidateQueries({ queryKey: ['admin-emoticons'] });
      toast.success('상태가 업데이트되었습니다.');
    },
  });
}

export function useAdminUpdateEmoticonPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) =>
      emoticonApi.adminUpdatePrice(id, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emoticonKeys.all });
      queryClient.invalidateQueries({ queryKey: ['admin-emoticons'] });
      toast.success('가격이 업데이트되었습니다.');
    },
  });
}

export function useDeleteEmoticonPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emoticonApi.deletePack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emoticonKeys.all });
      toast.success('이모티콘 팩이 삭제되었습니다.');
    },
  });
}

export function useAdminForceDeletePack() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => emoticonApi.adminForceDelete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: emoticonKeys.all });
            queryClient.invalidateQueries({ queryKey: ['admin-emoticons'] });
            queryClient.invalidateQueries({ queryKey: ['points'] });
            toast.success('이모티콘 팩이 완전히 삭제되었으며, 모든 구매자에게 포인트가 환불되었습니다.');
        },
        onError: (error: any) => {
            toast.error(error.message || '삭제 중 오류가 발생했습니다.');
        }
    });
}

export function useRestoreEmoticonPack() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => emoticonApi.restorePack(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: emoticonKeys.all });
            queryClient.invalidateQueries({ queryKey: ['admin-emoticons'] });
            toast.success('이모티콘 판매가 다시 시작되었습니다.');
        },
        onError: (error: any) => {
            toast.error(error.message || '판매 재개 중 오류가 발생했습니다.');
        }
    });
}
