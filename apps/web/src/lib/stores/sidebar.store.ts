import { create } from "zustand";

interface SidebarStore {
  expandedItems: Set<string>;
  setExpandedItems: (items: Set<string>) => void;
  updateExpandedItems: (updater: (prev: Set<string>) => Set<string>) => void;
  addExpandedItem: (itemId: string) => void;
  removeExpandedItem: (itemId: string) => void;
  toggleExpandedItem: (itemId: string) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  expandedItems: new Set<string>(),
  setExpandedItems: (items) => set({ expandedItems: items }),
  updateExpandedItems: (updater) =>
    set((state) => ({
      expandedItems: updater(state.expandedItems),
    })),
  addExpandedItem: (itemId) =>
    set((state) => {
      const newSet = new Set(state.expandedItems);
      newSet.add(itemId);
      return { expandedItems: newSet };
    }),
  removeExpandedItem: (itemId) =>
    set((state) => {
      const newSet = new Set(state.expandedItems);
      newSet.delete(itemId);
      return { expandedItems: newSet };
    }),
  toggleExpandedItem: (itemId) =>
    set((state) => {
      const newSet = new Set(state.expandedItems);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return { expandedItems: newSet };
    }),
}));
