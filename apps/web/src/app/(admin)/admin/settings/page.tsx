'use client';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useChatSettings, useClearChatHistory, useUpdateChatSettings } from '@/hooks/queries/use-chat-queries';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/queries/use-site-queries';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

const siteFormSchema = z.object({
  showSidebarAds: z.boolean(),
});
const chatFormSchema = z.object({
  enabled: z.boolean(),
  persistEnabled: z.boolean(),
  showOnlineCount: z.boolean(),
  showMessageTime: z.boolean(),
  defaultOpen: z.boolean(),
});
export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
    const { data: chatSettings, isLoading: chatLoading, isError: chatMissing } = useChatSettings();
  const updateChatSettings = useUpdateChatSettings();
  const clearChatHistory = useClearChatHistory();

  const siteForm = useForm<z.infer<typeof siteFormSchema>>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      showSidebarAds: true,
    },
  });
    const chatForm = useForm<z.infer<typeof chatFormSchema>>({
    resolver: zodResolver(chatFormSchema),
    defaultValues: {
      enabled: true,
      persistEnabled: true,
      showOnlineCount: false,
      showMessageTime: false,
      defaultOpen: true,
    },
  });
  useEffect(() => {
    if (settings) {
      siteForm.reset({
        showSidebarAds: settings.showSidebarAds,
      });
    }
  }, [settings, siteForm]);

  useEffect(() => {
    if (chatSettings) {
      chatForm.reset({
        enabled: chatSettings.enabled,
        persistEnabled: chatSettings.persistEnabled,
        showOnlineCount: chatSettings.showOnlineCount,
        showMessageTime: chatSettings.showMessageTime,
        defaultOpen: chatSettings.defaultOpen,
      });
    }
  }, [chatSettings, chatForm]);

  const onSubmitSite = (values: z.infer<typeof siteFormSchema>) => {
    updateSettings.mutate(values, {
      onSuccess: () => {
        toast.success('설정이 저장되었습니다.');
      },
      onError: () => {
        toast.error('설정 저장 중 오류가 발생했습니다.');
      },
    });
  };

  const onSubmitChat = (values: z.infer<typeof chatFormSchema>) => {
    updateChatSettings.mutate(values, {
      onSuccess: () => {
        toast.success('채팅 설정이 저장되었습니다.');
      },
      onError: () => {
        toast.error('채팅 설정 저장 중 오류가 발생했습니다.');
      },
    });
  };

  const handleClearChatHistory = () => {
    if (
      !confirm(
        '로비 채팅 기록을 모두 삭제하시겠습니까?\nDB 저장분과 Redis 캐시가 비워지며, 접속 중인 사용자 화면도 즉시 갱신됩니다.\n이 작업은 되돌릴 수 없습니다.',
      )
    ) {
      return;
    }
    clearChatHistory.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          result.deletedCount > 0
            ? `채팅 기록 ${result.deletedCount}건을 삭제했습니다.`
            : '채팅 기록을 비웠습니다.',
        );
      },
      onError: () => {
        toast.error('채팅 기록 삭제 중 오류가 발생했습니다.');
      },
    });
  };

  const showChatCard = !chatMissing;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
           <Skeleton className="h-8 w-32 mb-2" />
           <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-32 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">전역 환경 설정</h1>
        <p className="text-muted-foreground mt-2">
          사이트 전체에 적용되는 기능들을 설정합니다.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6 max-w-2xl shadow-sm">
        <Form {...siteForm}>
          <form onSubmit={siteForm.handleSubmit(onSubmitSite)} className="space-y-8">
            <FormField
              control={siteForm.control}
              name="showSidebarAds"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                  <div className="space-y-0.5 max-w-[80%]">
                    <FormLabel className="text-base">우측 사이드바 광고 표시</FormLabel>
                    <FormDescription>
                      활성화하면 게시판 등의 화면에서 우측 300px 영역을 할당하여 광고 슬롯 공간을 확보합니다.
                      (미구독자/일반 사용자용 레이아웃 분기 시 제어값으로 사용)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={updateSettings.isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? '저장 중...' : '변경사항 저장'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
      {showChatCard && (
        <div className="bg-card border rounded-lg p-6 max-w-2xl shadow-sm">
          <h2 className="text-lg font-semibold mb-1">실시간 채팅</h2>
          <p className="text-sm text-muted-foreground mb-6">
            채팅 모듈 전용 설정입니다. 사이트 전역 설정과 분리되어 있어 기존 포크에 채팅만 이식할 수 있습니다.
          </p>
          {chatLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Form {...chatForm}>
              <form onSubmit={chatForm.handleSubmit(onSubmitChat)} className="space-y-8">
                <FormField
                  control={chatForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                      <div className="space-y-0.5 max-w-[80%]">
                        <FormLabel className="text-base">채팅 사용</FormLabel>
                        <FormDescription>
                          끄면 채팅 UI가 숨겨지고 기존 소켓 접속도 끊깁니다.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateChatSettings.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={chatForm.control}
                  name="persistEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                      <div className="space-y-0.5 max-w-[80%]">
                        <FormLabel className="text-base">채팅 메시지 DB 저장</FormLabel>
                        <FormDescription>
                          켜면 채팅을 Postgres에 영구 저장합니다. 끄면 실시간 채팅은 그대로 동작하고,
                          최근 기록만 Redis에 유지됩니다. 재시작·캐시 만료 후 이전 대화는 복원되지 않습니다.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateChatSettings.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={chatForm.control}
                  name="showOnlineCount"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                      <div className="space-y-0.5 max-w-[80%]">
                        <FormLabel className="text-base">접속자 수 표시</FormLabel>
                        <FormDescription>
                          채팅 헤더에 실시간 접속자 수를 보여줍니다. 초기에 이용자가 적을 때는 꺼 두는 것을 권장합니다.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateChatSettings.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={chatForm.control}
                  name="showMessageTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                      <div className="space-y-0.5 max-w-[80%]">
                        <FormLabel className="text-base">채팅 시간 표시</FormLabel>
                        <FormDescription>
                          각 메시지 옆에 작성 시각(방금, N분 전 등)을 보여줍니다. 오래된 대화만 남아 있을 때는 꺼 두는 것을 권장합니다.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateChatSettings.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={chatForm.control}
                  name="defaultOpen"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                      <div className="space-y-0.5 max-w-[80%]">
                        <FormLabel className="text-base">채팅 패널 기본 노출</FormLabel>
                        <FormDescription>
                          켜면 사용자가 사이트에 처음 접속했을 때 채팅창이 열린 상태로 시작합니다. 끄면 FAB 아이콘 형태로 닫힌 상태로 시작합니다.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateChatSettings.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-destructive/30 p-4 bg-destructive/5">
                  <div className="space-y-0.5 max-w-[80%]">
                    <p className="text-base font-medium">채팅 기록 삭제</p>
                    <p className="text-sm text-muted-foreground">
                      로비의 모든 채팅 메시지를 삭제합니다. 초기 오픈 전 테스트 채팅을 지우거나, 오래된
                      대화를 정리할 때 사용하세요.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={clearChatHistory.isPending}
                    onClick={handleClearChatHistory}
                  >
                    {clearChatHistory.isPending ? '삭제 중...' : '채팅 기록 전체 삭제'}
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateChatSettings.isPending}>
                    {updateChatSettings.isPending ? '저장 중...' : '채팅 설정 저장'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      )}
    </div>
  );
}
