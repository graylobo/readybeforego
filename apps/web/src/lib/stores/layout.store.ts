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
  layoutMode: "sidebar",
  pendingPath: null,
  setPendingPath: (path) => set({ pendingPath: path }),
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
