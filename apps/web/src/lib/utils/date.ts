/**
 * 서버(Vercel 등은 UTC)와 브라우저(사용자 시간대)가 같은 글자를 그리도록 한국 시간 기준으로 날짜를 만든다.
 * 둘이 다르면 React가 하이드레이션 불일치로 그 구역을 브라우저에서 다시 그리고, 시간이 바뀌어 보인다.
 */
const SITE_TIME_ZONE = 'Asia/Seoul';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function toSiteParts(date: string | number | Date) {
  const parts: Record<string, string> = {};
  for (const { type, value } of partsFormatter.formatToParts(new Date(date))) parts[type] = value;
  return { yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute };
}

/** 지원 형식: yyyy, MM, dd, HH, mm 조합 (예: 'yyyy.MM.dd HH:mm', 'MM.dd', 'HH:mm') */
export function formatSiteDate(date: string | number | Date, pattern: string): string {
  const parts = toSiteParts(date);
  return pattern.replace(/yyyy|MM|dd|HH|mm/g, (token) => parts[token as keyof typeof parts]);
}

/** 한국 시간 기준 오늘인지 */
export function isSiteToday(date: string | number | Date): boolean {
  return formatSiteDate(date, 'yyyy.MM.dd') === formatSiteDate(Date.now(), 'yyyy.MM.dd');
}
