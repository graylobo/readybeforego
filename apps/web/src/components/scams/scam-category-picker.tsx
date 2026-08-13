"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/use-translation";
import {
  OTHER_CATEGORY,
  OTHER_NOTE_MAX_LENGTH,
  MAX_CATEGORY_COUNT,
  toggleCategorySelection,
  type ScamCategoryItem,
} from "@/lib/constants/scam-categories";
import { toast } from "sonner";

interface ScamCategoryPickerProps {
  items: ScamCategoryItem[];
  selectedCats: string[];
  onChange: (next: string[]) => void;
  otherNote: string;
  onOtherNoteChange: (note: string) => void;
  disabled?: boolean;
  error?: string;
  otherNoteError?: string;
  reportType?: "CAUTION" | "TIP" | "INFO";
}

export function ScamCategoryPicker({
  items,
  selectedCats,
  onChange,
  otherNote,
  onOtherNoteChange,
  disabled,
  error,
  otherNoteError,
  reportType = "CAUTION",
}: ScamCategoryPickerProps) {
  const { t } = useTranslation();
  const isOtherSelected = selectedCats.includes(OTHER_CATEGORY);

  const handleToggle = (value: string) => {
    const { next, warning } = toggleCategorySelection(selectedCats, value);
    if (warning === "max") {
      toast.warning("카테고리는 최대 3개까지 선택할 수 있습니다.", { id: "max-categories-warning" });
      return;
    }
    if (!next.includes(OTHER_CATEGORY) && otherNote) {
      onOtherNoteChange("");
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          카테고리(최소 1개, 최대 3개) <span className="text-red-500 font-bold">*</span>
        </Label>
        <span className="text-[10px] text-muted-foreground font-semibold">
          {isOtherSelected ? "선택됨: 기타" : `선택됨: ${selectedCats.length}/${MAX_CATEGORY_COUNT}`}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        {t("report_modal.category_hint")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
        {items.map((item) => {
          const isChecked = selectedCats.includes(item.value);
          const isOther = item.value === OTHER_CATEGORY;
          return (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              onClick={() => handleToggle(item.value)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                isOther ? "sm:col-span-2" : ""
              } ${
                isChecked
                  ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 font-semibold"
                  : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                  isChecked
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-slate-300 dark:border-slate-700 bg-transparent"
                }`}
              >
                {isChecked && (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <span className="truncate">{t(item.tKey)}</span>
            </button>
          );
        })}

        {isOtherSelected && (
          <div className="sm:col-span-2 space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="otherCategoryNote" className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {t("report_modal.other_note_label")} <span className="text-red-500">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {otherNote.length}/{OTHER_NOTE_MAX_LENGTH}
              </span>
            </div>
            <Input
              id="otherCategoryNote"
              value={otherNote}
              maxLength={OTHER_NOTE_MAX_LENGTH}
              placeholder={
                reportType === "TIP"
                  ? t("report_modal.other_note_placeholder_tip")
                  : t("report_modal.other_note_placeholder")
              }
              onChange={(e) => onOtherNoteChange(e.target.value)}
              disabled={disabled}
              className="text-xs h-9"
            />
          </div>
        )}
      </div>

      {error && <p className="text-[10px] text-red-500 font-semibold">⚠️ {error}</p>}
      {otherNoteError && <p className="text-[10px] text-red-500 font-semibold">⚠️ {otherNoteError}</p>}
    </div>
  );
}
