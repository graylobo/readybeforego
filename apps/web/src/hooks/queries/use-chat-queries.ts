import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ErrorCode, ErrorMessages, UpdateChatSettingsRequest } from '@community/shared-types';
import { chatApi } from '@/lib/api/chat';
import { useChatGuestStore } from '@/lib/stores/chat-guest.store';

export const chatKeys = {
  all: ['chat'] as const,
  settings: () => [...chatKeys.all, 'settings'] as const,
};

export function useChatSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chatKeys.settings(),
    queryFn: chatApi.getSettings,
    enabled: options?.enabled ?? true,
    staleTime: 5_000,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) return false;
      return failureCount < 2;
    },
    meta: { preventToast: true },
  });
}

export function useUpdateChatSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateChatSettingsRequest) => chatApi.updateSettings(data),
    onSuccess: (data) => {
      queryClient.setQueryData(chatKeys.settings(), data);
    },
  });
}

export function useClearChatHistory() {
  return useMutation({
    mutationFn: () => chatApi.clearMessages(),
  });
}

export function getChatApiErrorCode(error: unknown): ErrorCode | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return error.response?.data?.errorCode as ErrorCode | undefined;
}

export function useClaimGuestNickname() {
  const setGuest = useChatGuestStore((state) => state.setGuest);

  return useMutation({
    mutationFn: chatApi.claimGuestNickname,
    onSuccess: (data) => {
      setGuest(data.token, data.nickname, data.guestId);
    },
  });
}

export function guestNicknameErrorMessage(error: unknown): string {
  const code = getChatApiErrorCode(error);
  if (code === ErrorCode.CHAT_NICKNAME_TAKEN) {
    return ErrorMessages[ErrorCode.CHAT_NICKNAME_TAKEN];
  }
  if (code === ErrorCode.CHAT_NICKNAME_INVALID) {
    return ErrorMessages[ErrorCode.CHAT_NICKNAME_INVALID];
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '닉네임을 설정할 수 없습니다. 잠시 후 다시 시도해주세요.';
}
