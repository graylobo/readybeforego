import { create } from "zustand";

interface SidebarToggleStore {
  isOpen: boolean;
  toggle: () => void;
  setIsOpen: (isOpen: boolean) => void;
  layoutMode: 'push' | 'overlay';
  setLayoutMode: (mode: 'push' | 'overlay') => void;
}

export const useSidebarToggleStore = create<SidebarToggleStore>((set) => ({
  isOpen: false,
  layoutMode: 'push',
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  setLayoutMode: (mode: 'push' | 'overlay') => set({ layoutMode: mode }),
}));
