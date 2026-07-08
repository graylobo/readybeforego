import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { profileApi } from '@/lib/api/profile';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRouter } from 'next/navigation';

export const profileKeys = {
  all: ['profile'] as const,
  public: (id: string) => [...profileKeys.all, 'public', id] as const,
};

export function usePublicProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.public(id),
    queryFn: () => profileApi.getPublicProfile(id),
    enabled: !!id,
  });
}

export function useUpdateProfile() {
// ... existing code ...
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: ({ data, options }: { data: { name?: string; picture?: string; isProfileSetup?: boolean }; options?: import('axios').AxiosRequestConfig }) => 
      profileApi.updateProfile(data, options),
    onSuccess: (updatedUser) => {
      // Update global user state
      const token = localStorage.getItem('access_token') || '';
      setAuth(token, updatedUser);
      
      // Invalidate related queries if any
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useWithdrawAccount() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: () => profileApi.withdrawAccount(),
    onSuccess: () => {
      logout();
      router.push('/');
    },
  });
}
