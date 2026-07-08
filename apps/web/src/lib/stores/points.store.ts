import { create } from 'zustand';
import { pointsApi, UserPoints } from '@/lib/api/points';

interface PointsState {
  points: UserPoints | null;
  isLoading: boolean;
  fetchPoints: () => Promise<void>;
}

export const usePointsStore = create<PointsState>((set) => ({
  points: null,
  isLoading: false,
  fetchPoints: async () => {
    set({ isLoading: true });
    try {
      const points = await pointsApi.getMyPoints();
      set({ points });
    } catch (error) {
      console.error('Failed to fetch points:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
