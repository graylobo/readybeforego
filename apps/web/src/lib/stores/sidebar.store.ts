import { create } from "zustand";

interface SidebarStore {
  /** 사용자가 접은 메뉴 id. 기본은 모두 펼침이라, 서버 렌더링 HTML부터 펼쳐진 상태로 그려진다 */
  collapsedItems: Set<string>;
  toggleExpandedItem: (itemId: string) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  collapsedItems: new Set<string>(),
  toggleExpandedItem: (itemId) =>
    set((state) => {
      const next = new Set(state.collapsedItems);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return { collapsedItems: next };
    }),
}));
