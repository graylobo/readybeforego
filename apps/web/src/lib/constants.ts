/**
 * 프로젝트 전역에서 사용되는 사이트 및 기술적 상수 정의
 */

export const SITE_CONFIG = {
  name: "ReadyBeforeGo",
  description: "여행 중 사기, 호객, 바가지를 피하기 위한 실시간 위험 경고 정보 플랫폼",
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  locale: "ko_KR",
  author: "ReadyBeforeGo Team",
  keywords: ["여행 사기", "호객 행위", "바가지 요금", "안전 여행", "ReadyBeforeGo", "readybeforego"],
  gaId: process.env.NEXT_PUBLIC_GA_ID,
  googleConsoleId: process.env.NEXT_PUBLIC_GOOGLE_CONSOLE_ID,
  adsenseId: process.env.NEXT_PUBLIC_ADSENSE_ID,
  clarityId: process.env.NEXT_PUBLIC_CLARITY_ID,
};

export const UI_CONFIG = {
  defaultTitleTemplate: `%s | ${SITE_CONFIG.name}`,
  robotsIndex: true,
  robotsFollow: true,
};
