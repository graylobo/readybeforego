'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isAdmin, isStaff, USER_ROLES } from '@community/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useUpdateProfile, useWithdrawAccount } from '@/hooks/queries/use-profile-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils/cn';
import { AlertCircle, Camera, ChevronRight, Coins, Loader2, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { UserActivityLog } from './user-activity-log';
import { uploadsApi } from '@/lib/api/uploads';
import { toast } from '@/lib/toast';

const nicknameSchema = z.string()
  .min(2, '닉네임은 2자 이상이어야 합니다.')
  .max(10, '닉네임은 10자 이하이어야 합니다.')
  .regex(/^[가-힣a-zA-Z0-9]+$/, '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다. (공백 및 특수문자 불가)');

// 추후 활동 로그 기능 활성화 여부
const ENABLE_USER_ACTIVITY_LOG = false;

export function ProfileForm() {
  const { user, checkAuth } = useAuthStore();
  const { lang, setLang } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [name, setName] = useState(user?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [activeTab, setActiveTab] = useState<'settings' | 'activity'>('settings');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Mutations
  const updateProfileMutation = useUpdateProfile();
  const withdrawAccountMutation = useWithdrawAccount();

  useEffect(() => {
    checkAuth(true);
  }, []);

  useEffect(() => {
    if (user) {
        setName(user.name);
    }
  }, [user]);

  useEffect(() => {
    if (isEditingName) {
      const result = nicknameSchema.safeParse(name);
      if (result.success) {
        setValidationError(null);
        setIsValid(true);
      } else {
        setValidationError(result.error.issues[0]?.message || '올바르지 않은 형식입니다.');
        setIsValid(false);
      }
    } else {
      setValidationError(null);
      setIsValid(true);
    }
  }, [name, isEditingName]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!user) return null;

  // Level Calc
  const currentLevel = user.level || 1;
  const nextLevelPoints = Math.pow(currentLevel, 2) * 100;
  const currentAccPoints = user.accumulatedPoints || 0;
  const remainingPoints = Math.max(0, nextLevelPoints - currentAccPoints);
  const progress = Math.min(100, (currentAccPoints / nextLevelPoints) * 100);

  const handleNameUpdate = async () => {
      const result = nicknameSchema.safeParse(name);
      if (!result.success) return;
      
      if ((user.availablePoints || 0) < 500) {
          alert('닉네임 변경을 위한 포인트가 부족합니다.');
          return;
      }

      updateProfileMutation.mutate({ 
          data: { name },
          options: { _skipToast: true }
      }, {
          onSuccess: () => {
              setIsEditingName(false);
          },
          onError: (error: any) => {
              const message = error.response?.data?.message || '프로필 설정 중 오류가 발생했습니다.';
              setValidationError(message);
              setIsValid(false);
          }
      });
  };

  const handleWithdrawAccount = async () => {
    if (confirm('정말로 탈퇴하시겠습니까? 모든 데이터가 영구적으로 삭제됩니다.')) {
      withdrawAccountMutation.mutate(undefined, {
        onError: () => {
          // 에러 인터셉터에서 처리됨
        }
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
          toast.error('이미지 파일만 업로드 가능합니다.');
          return;
      }

      if (file.size > 5 * 1024 * 1024) {
          toast.error('파일 크기는 5MB를 초과할 수 없습니다.');
          return;
      }

      setIsUploadingAvatar(true);
      setAvatarProgress(0);

      try {
          const url = await uploadsApi.uploadImage(file, {
              compress: true,
              folder: 'profiles',
              onProgress: (p) => setAvatarProgress(p)
          });

          await updateProfileMutation.mutateAsync({ data: { picture: url } });
          
          // 업로드 및 업데이트가 완벽히 성공한 그 직후에,
          // 로컬 파일을 이용하여 딜레이 없이 알람과 동시에 이미지를 변경 (UX 개선)
          const objectUrl = URL.createObjectURL(file);
          setPreviewUrl(objectUrl);
          toast.success('프로필 이미지가 변경되었습니다.');
      } catch (error) {
          console.error('Failed to upload avatar:', error);
          toast.error('이미지 업로드에 실패했습니다.');
      } finally {
          setIsUploadingAvatar(false);
          setAvatarProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const hasEnoughPoints = (user.availablePoints || 0) >= 500;

  const getRoleBadge = (role: any) => {
    switch (role) {
      case USER_ROLES.SUPER_ADMIN:
        return (
          <Badge className="bg-purple-500 hover:bg-purple-600 border-none gap-1">
            <ShieldAlert className="w-3 h-3" /> Super Admin
          </Badge>
        );
      case USER_ROLES.ADMIN:
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 border-none gap-1">
            <ShieldCheck className="w-3 h-3" /> Admin
          </Badge>
        );
      case USER_ROLES.MODERATOR:
        return (
          <Badge className="bg-green-500 hover:bg-green-600 border-none gap-1">
            <Shield className="w-3 h-3" /> Moderator
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-10 space-y-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
            <AvatarImage src={previewUrl || user.picture || ''} className="object-cover" />
            <AvatarFallback className="text-4xl">{user.name[0]}</AvatarFallback>
          </Avatar>
           {/* Camera Overlay */}
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploadingAvatar ? (
                <div className="flex flex-col items-center gap-1">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <span className="text-[10px] text-white font-bold">{avatarProgress}%</span>
                </div>
            ) : (
                <Camera className="w-8 h-8 text-white" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={updateProfileMutation.isPending || isUploadingAvatar}
            onChange={handleFileChange}
          />
        </div>
        
        <div className="text-center space-y-4">
          <div className="space-y-1">
              {getRoleBadge(user.role as any)}
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold">{user.name}</h1>
            </div>

            <p className="text-muted-foreground">{user.email}</p>
          </div>

          <button 
            onClick={() => router.push('/points')}
            className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted rounded-2xl transition-all active:scale-95 group border border-transparent hover:border-border shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-bold shrink-0">Lv. {currentLevel}</Badge>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-background/50 rounded-full font-bold text-sm">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span>{(user.availablePoints || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground ml-0.5">P</span></span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="w-full max-w-xs mx-auto mt-4 space-y-2">
            <div className="group relative">
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded border shadow-sm whitespace-nowrap z-10">
                 Lv.{currentLevel + 1}까지 {(remainingPoints).toLocaleString()} P 남음
               </div>
               <Progress value={progress} className="h-2 cursor-help" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1 font-medium">
               <span>Lv.{currentLevel}</span>
               <span>Lv.{currentLevel + 1}</span>
            </div>
          </div>
        </div>
      </div>

      {ENABLE_USER_ACTIVITY_LOG && (
        <div className="flex bg-muted/50 p-1 rounded-xl w-fit mx-auto">
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'settings' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            프로필 설정
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'activity' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            활동 내역
          </button>
        </div>
      )}

      {(!ENABLE_USER_ACTIVITY_LOG || activeTab === 'settings') ? (
        <div className="grid gap-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold">프로필 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-semibold">닉네임</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!isEditingName || updateProfileMutation.isPending}
                      placeholder="닉네임을 입력하세요"
                      className={`h-10 transition-all ${isEditingName && validationError ? 'border-red-500 ring-red-500/10' : ''}`}
                    />
                    {isEditingName ? (
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          onClick={handleNameUpdate} 
                          disabled={updateProfileMutation.isPending || !!validationError || name === user.name || !hasEnoughPoints}
                          className="font-bold"
                        >
                          {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
                        </Button>
                        <Button variant="ghost" onClick={() => {
                          setName(user.name);
                          setIsEditingName(false);
                        }} disabled={updateProfileMutation.isPending} className="font-bold">
                          취소
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditingName(true)}
                        className="font-bold shrink-0"
                      >
                        변경하기
                      </Button>
                    )}
                  </div>
                  {isEditingName && (
                    <p className={`text-xs font-semibold ${validationError ? 'text-red-500' : 'text-green-600'}`}>
                      {validationError || '사용 가능한 닉네임 형식입니다.'}
                    </p>
                  )}
                </div>
                
                {isEditingName && (
                  <Alert className={`border-primary/20 transition-colors ${!hasEnoughPoints ? 'bg-destructive/10' : 'bg-primary/5'}`}>
                    <AlertCircle className={`h-4 w-4 ${!hasEnoughPoints ? 'text-destructive' : 'text-primary'}`} />
                    <AlertTitle className={`text-sm font-bold ${!hasEnoughPoints ? 'text-destructive' : ''}`}>
                      닉네임 변경 안내
                    </AlertTitle>
                    <AlertDescription className="text-xs font-medium opacity-80 mt-1">
                      닉네임 변경 시 <strong>500 포인트</strong>가 차감됩니다. <br/>
                      현재 가용 포인트: {(user.availablePoints || 0).toLocaleString()} P
                      {!hasEnoughPoints && (
                          <p className="text-destructive font-bold mt-2">포인트가 부족하여 닉네임을 변경할 수 없습니다.</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-sm font-semibold">언어 설정 (Language Settings)</Label>
                <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/60 w-fit">
                  <Button
                    size="sm"
                    variant={lang === "ko" ? "default" : "ghost"}
                    className="h-7 px-3 text-xs font-bold cursor-pointer transition-all active:scale-95"
                    onClick={() => setLang("ko")}
                  >
                    한국어 (KO)
                  </Button>
                  <Button
                    size="sm"
                    variant={lang === "en" ? "default" : "ghost"}
                    className="h-7 px-3 text-xs font-bold cursor-pointer transition-all active:scale-95"
                    onClick={() => setLang("en")}
                  >
                    English (EN)
                  </Button>
                </div>
              </div>
              
               <div className="space-y-1 pt-4 border-t">
                   <div className="flex justify-between text-sm py-2">
                       <span className="text-muted-foreground">가입일</span>
                       <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                   </div>
               </div>

            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-destructive">계정 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold">회원 탈퇴</p>
                  <p className="text-xs text-muted-foreground font-medium">탈퇴 시 작성한 게시글을 포함한 모든 정보가 즉시 삭제되며 복구할 수 없습니다.</p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleWithdrawAccount}
                  disabled={withdrawAccountMutation.isPending}
                  className="font-bold shrink-0"
                >
                  {withdrawAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '회원 탈퇴'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <UserActivityLog />
      )}
    </div>
  );
}
