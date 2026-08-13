export const OTHER_CATEGORY = "OTHER";
export const OTHER_NOTE_MAX_LENGTH = 40;
export const OTHER_NOTE_MIN_LENGTH = 2;
export const MAX_CATEGORY_COUNT = 3;

export type ScamCategoryItem = {
  value: string;
  tKey: string;
};

export const CAUTION_CATEGORY_ITEMS: ScamCategoryItem[] = [
  { value: "FORCED_SHOPPING", tKey: "categories.FORCED_SHOPPING" },
  { value: "DRUG_HAZARD", tKey: "categories.DRUG_HAZARD" },
  { value: "LIES_TOURISM", tKey: "categories.LIES_TOURISM" },
  { value: "FAKE_TAXI", tKey: "categories.FAKE_TAXI" },
  { value: "OVERCHARGING", tKey: "categories.OVERCHARGING" },
  { value: OTHER_CATEGORY, tKey: "categories.OTHER" },
];

export const TIP_CATEGORY_ITEMS: ScamCategoryItem[] = [
  { value: "ADVANCE_BOOKING", tKey: "tip_categories.ADVANCE_BOOKING" },
  { value: "PHOTO_SPOT", tKey: "tip_categories.PHOTO_SPOT" },
  { value: "HIDDEN_GEM", tKey: "tip_categories.HIDDEN_GEM" },
  { value: "FOOD_RECOMMENDATION", tKey: "tip_categories.FOOD_RECOMMENDATION" },
  { value: "MONEY_TIP", tKey: "tip_categories.MONEY_TIP" },
  { value: "TRANSPORT_TIP", tKey: "tip_categories.TRANSPORT_TIP" },
  { value: "FACILITY_INFO", tKey: "tip_categories.FACILITY_INFO" },
  { value: OTHER_CATEGORY, tKey: "tip_categories.OTHER" },
];

export const CATEGORY_MAP: Record<string, { label: string; color: string; icon: string }> = {
  FORCED_SHOPPING: { label: "🛍️ 호객/강매", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300", icon: "🛍️" },
  DRUG_HAZARD: { label: "💊 약물 위험", color: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300", icon: "💊" },
  LIES_TOURISM: { label: "🗣️ 가짜 관광정보", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300", icon: "🗣️" },
  FAKE_TAXI: { label: "🚕 가짜 택시/바가지", color: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300", icon: "🚕" },
  OVERCHARGING: { label: "💸 바가지 요금", color: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300", icon: "💸" },
  ADVANCE_BOOKING: { label: "🎒 사전 예약/패스", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300", icon: "🎒" },
  PHOTO_SPOT: { label: "📸 촬영 포인트", color: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300", icon: "📸" },
  HIDDEN_GEM: { label: "🗺️ 숨은 명소", color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300", icon: "🗺️" },
  FOOD_RECOMMENDATION: { label: "🍜 맛집 추천", color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300", icon: "🍜" },
  MONEY_TIP: { label: "💰 환전/결제 팁", color: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300", icon: "💰" },
  TRANSPORT_TIP: { label: "🚆 교통/이동 팁", color: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300", icon: "🚆" },
  FACILITY_INFO: { label: "📦 짐보관/편의시설", color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300", icon: "📦" },
  OTHER: { label: "📝 기타", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300", icon: "📝" },
};

export function parseCategories(value?: string | null): string[] {
  return value ? value.split(",").map((c) => c.trim()).filter(Boolean) : [];
}

export function hasOtherCategory(categories: string[] | string | null | undefined): boolean {
  const list = Array.isArray(categories) ? categories : parseCategories(categories);
  return list.includes(OTHER_CATEGORY);
}

export function toggleCategorySelection(
  selected: string[],
  value: string,
  max = MAX_CATEGORY_COUNT,
): { next: string[]; warning?: "max" } {
  const isChecked = selected.includes(value);

  if (isChecked) {
    return { next: selected.filter((c) => c !== value) };
  }

  if (value === OTHER_CATEGORY) {
    return { next: [OTHER_CATEGORY] };
  }

  const withoutOther = selected.filter((c) => c !== OTHER_CATEGORY);
  if (withoutOther.length >= max) {
    return { next: selected, warning: "max" };
  }

  return { next: [...withoutOther, value] };
}

export function getCategoryInfo(
  cat: string,
  t: (key: string) => string,
  note?: string | null,
) {
  const info = CATEGORY_MAP[cat] || {
    label: cat,
    color: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
    icon: "📝",
  };

  const cautionKey = `categories.${cat}`;
  const tipKey = `tip_categories.${cat}`;
  const cautionTranslated = t(cautionKey);
  const tipTranslated = t(tipKey);
  const translated =
    cautionTranslated !== cautionKey
      ? cautionTranslated
      : tipTranslated !== tipKey
        ? tipTranslated
        : info.label;

  const trimmedNote = note?.trim();
  return {
    ...info,
    label: cat === OTHER_CATEGORY && trimmedNote ? `${translated} · ${trimmedNote}` : translated,
  };
}
