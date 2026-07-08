import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentBoard {
  slug: string;
  name: string;
}

interface RecentBoardsState {
  recentBoards: RecentBoard[];
  addBoard: (board: RecentBoard) => void;
  removeBoard: (slug: string) => void;
  clearBoards: () => void;
}

export const useRecentBoardsStore = create<RecentBoardsState>()(
  persist(
    (set) => ({
      recentBoards: [],
      addBoard: (board) => set((state) => {
        const filtered = state.recentBoards.filter((b) => b.slug !== board.slug);
        return {
          recentBoards: [board, ...filtered].slice(0, 10), // keep top 10 recent
        };
      }),
      removeBoard: (slug) => set((state) => ({
        recentBoards: state.recentBoards.filter((b) => b.slug !== slug),
      })),
      clearBoards: () => set({ recentBoards: [] }),
    }),
    {
      name: 'recent-boards-storage',
    }
  )
);
