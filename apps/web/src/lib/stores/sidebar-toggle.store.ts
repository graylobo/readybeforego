import { create } from "zustand";

const isDesktopViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

interface SidebarToggleStore {
  /**
   * null: 사용자가 아직 열거나 닫지 않음 → 화면 크기 기본값(데스크톱 열림, 모바일 닫힘)을 CSS로 그린다.
   * 서버 렌더링 HTML과 첫 화면이 같아서, 하이드레이션 전에도 사이드바가 제 모양으로 보인다.
   */
  isOpen: boolean | null;
  toggle: () => void;
  setIsOpen: (isOpen: boolean) => void;
  layoutMode: 'push' | 'overlay';
  setLayoutMode: (mode: 'push' | 'overlay') => void;
}

export const useSidebarToggleStore = create<SidebarToggleStore>((set) => ({
  isOpen: null,
  layoutMode: 'push',
  toggle: () => set((state) => ({ isOpen: !(state.isOpen ?? isDesktopViewport()) })),
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  setLayoutMode: (mode: 'push' | 'overlay') => set({ layoutMode: mode }),
}));
