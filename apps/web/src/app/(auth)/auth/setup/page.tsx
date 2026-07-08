'use client';

import { useAuthStore } from '@/lib/stores/auth.store';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useUpdateProfile } from '@/hooks/queries/use-profile-queries';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const nicknameSchema = z.string()
  .min(2, '닉네임은 2자 이상이어야 합니다.')
  .max(10, '닉네임은 10자 이하이어야 합니다.')
  .regex(/^[가-힣a-zA-Z0-9]+$/, '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다. (공백 및 특수문자 불가)');

export default function AuthSetupPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const updateProfileMutation = useUpdateProfile();
  
  const [name, setName] = useState(user?.name || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (user) {
      // 닉네임 기본값 설정 (특수문자 제거 시도)
      const sanitizedInitial = user.name.replace(/[^가-힣a-zA-Z0-9]/g, '');
      setName(sanitizedInitial);
    }
  }, [user]);

  useEffect(() => {
    const result = nicknameSchema.safeParse(name);
    if (result.success) {
      setValidationError(null);
      setIsValid(true);
    } else {
      setValidationError(result.error.issues[0]?.message || '올바르지 않은 형식입니다.');
      setIsValid(false);
    }
  }, [name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    updateProfileMutation.mutate({ 
      data: {
        name, 
        isProfileSetup: true 
      },
      options: { _skipToast: true }
    }, {
      onSuccess: () => {
        router.replace('/');
      },
      onError: (error: any) => {
        const message = error.response?.data?.message || '프로필 설정 중 오류가 발생했습니다.';
        setValidationError(message);
        setIsValid(false);
      }

    });
  };

  if (!user) return null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md border-none shadow-2xl bg-background/60 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Avatar className="w-20 h-20 border-4 border-primary/10">
              <AvatarImage src={user.picture || ''} />
              <AvatarFallback className="text-2xl">{user.name[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight">환영합니다!</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">
              사용할 닉네임을 설정해주세요.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-sm font-bold ml-1">닉네임</Label>
                <div className="relative">
                  <Input
                    id="nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="2~10자 한글, 영문, 숫자"
                    className={`h-12 px-4 transition-all ${validationError ? 'border-destructive focus-visible:ring-destructive/20' : 'focus-visible:ring-primary/20'}`}
                    disabled={updateProfileMutation.isPending}
                  />
                  {isValid && (
                     <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                </div>
                <div className="min-h-[20px] ml-1">
                  {validationError ? (
                    <div className="flex items-center gap-1.5 text-destructive text-xs font-bold animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {validationError}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground font-medium">
                      설정한 닉네임은 나중에 프로필에서 변경할 수 있습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-bold transition-all active:scale-[0.98]"
              disabled={!isValid || updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>설정 중...</span>
                </div>
              ) : (
                '시작하기'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
