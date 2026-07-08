import { useI18nStore } from "@/lib/stores/i18n.store";
import ko from "@/lib/i18n/ko.json";
import en from "@/lib/i18n/en.json";

const dictionaries = { ko, en };

export function useTranslation() {
  const { lang, setLang } = useI18nStore();
  const dict = dictionaries[lang] || ko;

  const t = (path: string, replaces?: Record<string, string | number>): string => {
    const keys = path.split(".");
    let current: any = dict;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return path;
      }
    }

    if (typeof current !== "string") {
      return path;
    }

    let result = current;
    if (replaces) {
      Object.entries(replaces).forEach(([key, val]) => {
        result = result.replace(new RegExp(`{${key}}`, "g"), String(val));
      });
    }

    return result;
  };

  return { t, lang, setLang };
}
