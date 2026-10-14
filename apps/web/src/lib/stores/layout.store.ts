import { LayoutMode, writeLayoutModeCookie } from "@/lib/layout-mode";
import { create } from "zustand";

interface LayoutState {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleLayoutMode: () => void;
  pendingPath: string | null;
  setPendingPath: (path: string | null) => void;
}

export const useLayoutStore = create<LayoutState>()((set) => ({
  layoutMode: "top",
  pendingPath: null,
  // 이동 완료는 pathname으로 판단하므로 쿼리/해시는 떼고 저장한다 (붙어 있으면 이동 후에도 대기 상태가 풀리지 않음)
  setPendingPath: (path) => set({ pendingPath: path?.startsWith('/') ? path.split(/[?#]/)[0] : null }),
  setLayoutMode: (mode) => {
    writeLayoutModeCookie(mode);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-layout", mode);
    }
    set({ layoutMode: mode });
  },
  toggleLayoutMode: () =>
    set((state) => {
      const nextMode: LayoutMode =
        state.layoutMode === "sidebar" ? "top" : "sidebar";
      writeLayoutModeCookie(nextMode);
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-layout", nextMode);
      }
      return { layoutMode: nextMode };
    }),
}));

/** 서버에서 읽은 초기값으로 스토어와 html data-layout을 동기화 */
export function syncLayoutMode(mode: LayoutMode) {
  useLayoutStore.setState({ layoutMode: mode });
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-layout", mode);
  }
}

export type { LayoutMode };

/**
 * 링크를 일반 클릭했을 때만 이동 중 주소를 알린다.
 * (Ctrl/Cmd/Shift 클릭은 새 탭/창으로 열려 이 탭의 주소가 바뀌지 않으므로, 알리면 스켈레톤이 풀리지 않는다)
 */
export function markPendingNavigation(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, href: string) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  useLayoutStore.getState().setPendingPath(href);
}

