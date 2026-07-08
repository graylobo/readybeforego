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
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/queries/use-site-queries';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

const formSchema = z.object({
  showSidebarAds: z.boolean(),
});

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      showSidebarAds: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        showSidebarAds: settings.showSidebarAds,
      });
    }
  }, [settings, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateSettings.mutate(values, {
      onSuccess: () => {
        toast.success('설정이 저장되었습니다.');
      },
      onError: () => {
        toast.error('설정 저장 중 오류가 발생했습니다.');
      },
    });
  };

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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
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
    </div>
  );
}
