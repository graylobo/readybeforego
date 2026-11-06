import type { SightingDatePrecision } from "@community/shared-types";

export type SightingWhen = "today" | "week" | "month" | "earlier" | "exact";

export const SIGHTING_WHEN_OPTIONS: { value: SightingWhen; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
  { value: "earlier", label: "더 이전" },
  { value: "exact", label: "날짜 직접 입력" },
];

const EARLIER_MONTH_COUNT = 60;

const pad = (value: number) => String(value).padStart(2, "0");

export const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// 이번 달 이전의 달을 최근순으로 돌려준다 (value: YYYY-MM)
export function earlierMonthOptions(now = new Date()) {
  return Array.from({ length: EARLIER_MONTH_COUNT }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index - 1, 1);
    return {
      value: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
      label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
    };
  });
}

export function resolveSightingDate(
  when: SightingWhen | null,
  input: { earlierMonth?: string; exactDate?: string },
  now = new Date(),
): { seenOn: string; seenPrecision: SightingDatePrecision } | null {
  switch (when) {
    case "today":
      return { seenOn: formatLocalDate(now), seenPrecision: "day" };
    case "week": {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
      return { seenOn: formatLocalDate(monday), seenPrecision: "week" };
    }
    case "month":
      return { seenOn: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, seenPrecision: "month" };
    case "earlier":
      return input.earlierMonth ? { seenOn: `${input.earlierMonth}-01`, seenPrecision: "month" } : null;
    case "exact":
      return input.exactDate && input.exactDate <= formatLocalDate(now)
        ? { seenOn: input.exactDate, seenPrecision: "day" }
        : null;
    default:
      return null;
  }
}

// 정확한 날짜를 모르는 기록은 그 정밀도까지만 보여 준다
export function formatSightingDate(seenOn: string, precision: SightingDatePrecision): string {
  const [year, month, day] = seenOn.split("-").map(Number);
  if (precision === "month") return `${year}년 ${month}월쯤`;
  if (precision === "week") return `${year}년 ${month}월 ${day}일 주간`;
  return `${year}년 ${month}월 ${day}일`;
}
