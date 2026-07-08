'use client';

import { useAdminUsers, useUpdateUserRole, useWarnUser, useSuspendUser, useBanUser, useReactivateUser } from '@/hooks/queries/use-admin-queries';
import { useSendMessage } from '@/hooks/queries/use-message-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { toast } from '@/lib/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { 
  MoreHorizontal, 
  Shield, 
  User as UserIcon, 
  ShieldAlert, 
  ShieldCheck, 
  Ban, 
  AlertTriangle, 
  Mail,
  Clock,
  Unlock,
  Search,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isSuperAdmin, UserRole, USER_ROLES, UserStatus } from '@community/shared-types';
import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/use-debounce'; // Assuming this hook exists or I should implement it
import { ModerationHistoryDialog } from './moderation-history-dialog';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  
  const { data: users, isLoading } = useAdminUsers(debouncedSearch);
  
  const [historyTarget, setHistoryTarget] = useState<{ id: string, name: string } | null>(null);

  const updateRoleMutation = useUpdateUserRole();
  const warnMutation = useWarnUser();
  const suspendMutation = useSuspendUser();
  const banMutation = useBanUser();
  const reactivateMutation = useReactivateUser();
  const sendMessageMutation = useSendMessage();

  const canChangeRole = isSuperAdmin(currentUser?.role);

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (!canChangeRole) return;
    updateRoleMutation.mutate({ id: userId, role: newRole }, {
      onSuccess: () => toast.success('사용자 권한이 변경되었습니다.'),
    });
  };

  const handleWarn = (userId: string) => {
    const reason = prompt('경고 사유를 입력하세요:');
    if (!reason) return;
    warnMutation.mutate({ id: userId, reason }, {
      onSuccess: () => toast.success('유저에게 경고를 부여했습니다.'),
    });
  };

  const handleSuspend = (userId: string) => {
    const daysStr = prompt('정지 기간(일)을 입력하세요:');
    if (!daysStr) return;
    const days = parseInt(daysStr);
    if (isNaN(days)) return alert('올바른 숫자를 입력하세요.');
    
    const reason = prompt('정지 사유를 입력하세요:');
    if (!reason) return;

    suspendMutation.mutate({ id: userId, reason, days }, {
      onSuccess: () => toast.success(`${days}일간 정지 처리되었습니다.`),
    });
  };

  const handleBan = (userId: string) => {
    const reason = prompt('영구 정지 사유를 입력하세요:');
    if (!reason) return;
    if (!confirm('정말 영구 정지하시겠습니까?')) return;

    banMutation.mutate({ id: userId, reason }, {
      onSuccess: () => toast.success('영구 정지 처리되었습니다.'),
    });
  };

  const handleReactivate = (userId: string) => {
    const reason = prompt('해제 사유를 입력하세요:');
    if (!reason) return;
    reactivateMutation.mutate({ id: userId, reason }, {
      onSuccess: () => toast.success('제재가 해제되었습니다.'),
    });
  };

  const handleSendMessage = (userId: string) => {
    const content = prompt('보낼 쪽지 내용을 입력하세요:');
    if (!content) return;
    sendMessageMutation.mutate({ receiverId: userId, content }, {
      onSuccess: () => toast.success('쪽지를 보냈습니다.'),
    });
  };

  const getRoleBadge = (role: UserRole) => {
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
        return (
          <Badge variant="secondary" className="gap-1">
            <UserIcon className="w-3 h-3" /> User
          </Badge>
        );
    }
  };

  const getStatusBadge = (user: any) => {
    switch (user.status as UserStatus) {
      case 'banned':
        return <Badge variant="destructive" className="gap-1"><Ban className="w-3 h-3" /> Banned</Badge>;
      case 'suspended':
        return (
          <Badge variant="outline" className="text-orange-500 border-orange-500 gap-1">
            <Clock className="w-3 h-3" /> Suspended
            {user.bannedUntil && <span className="text-[10px] ml-1">({format(new Date(user.bannedUntil), 'MM/dd')})</span>}
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-green-500 border-green-500">Active</Badge>;
    }
  };

  if (isLoading && !debouncedSearch) {
    return (
      <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
             <Skeleton className="h-8 w-48" />
          </div>
          <div className="border border-border rounded-md">
             <div className="p-4 flex flex-col gap-4">
                 {Array.from({ length: 5 }).map((_, i) => (
                     <Skeleton key={i} className="h-12 w-full" />
                 ))}
             </div>
          </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">사용자 관리</h1>
          <span className="text-muted-foreground">Total: {users?.length || 0}</span>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="pl-10 h-10 rounded-xl"
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" /> Staff Roles
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Super Admin(전권), Admin(운영), Moderator(중재) 권한을 부여하여 사이트를 관리합니다.
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-wider">
            <Ban className="w-3 h-3" /> Restriction
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            활동 정지(Suspended) 및 영구 정지(Banned) 상태인 유저는 글쓰기 및 반응하기가 제한됩니다.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User Info</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Warnings</TableHead>
              <TableHead>Joined At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-muted-foreground font-medium">
                  검색 결과가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canChangeRole ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer hover:opacity-80 transition-opacity">
                            {getRoleBadge(user.role as UserRole)}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>권한 변경</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleRoleChange(user.id, USER_ROLES.USER)}>
                            <UserIcon className="w-4 h-4 mr-2" /> User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(user.id, USER_ROLES.MODERATOR)}>
                            <Shield className="w-4 h-4 mr-2 text-green-500" /> Moderator
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(user.id, USER_ROLES.ADMIN)}>
                            <ShieldCheck className="w-4 h-4 mr-2 text-blue-500" /> Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(user.id, USER_ROLES.SUPER_ADMIN)}>
                            <ShieldAlert className="w-4 h-4 mr-2 text-purple-500" /> Super Admin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div>{getRoleBadge(user.role as UserRole)}</div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(user)}</TableCell>
                  <TableCell>
                    {user.warningCount > 0 ? (
                      <Badge variant="outline" className="text-red-500 border-red-500">{user.warningCount}</Badge>
                    ) : '0'}
                  </TableCell>
                  <TableCell>
                      {user.createdAt ? format(new Date(user.createdAt), 'yyyy-MM-dd') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleSendMessage(user.id)}>
                            <Mail className="w-4 h-4 mr-2" /> 쪽지 보내기
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setHistoryTarget({ id: user.id, name: user.name })}>
                            <History className="w-4 h-4 mr-2 font-bold" /> 제재 히스토리
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleWarn(user.id)}>
                            <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" /> 경고 주기
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSuspend(user.id)}>
                            <Clock className="w-4 h-4 mr-2 text-orange-500" /> 활동 정지
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBan(user.id)} className="text-red-500">
                            <Ban className="w-4 h-4 mr-2" /> 영구 정지
                          </DropdownMenuItem>
                          {(user.status !== 'active' || user.warningCount > 0) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleReactivate(user.id)} className="text-green-600">
                                <Unlock className="w-4 h-4 mr-2" /> 제재 해제
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.id)}>
                            Copy ID
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ModerationHistoryDialog 
        userId={historyTarget?.id || null}
        userName={historyTarget?.name || null}
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
