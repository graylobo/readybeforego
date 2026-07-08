import { create } from "zustand";
import { persist } from "zustand/middleware";

interface I18nStore {
  lang: "ko" | "en";
  setLang: (lang: "ko" | "en") => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      lang: "ko",
      setLang: (lang) => set({ lang }),
    }),
    {
      name: "hogaengno-lang",
    }
  )
);
