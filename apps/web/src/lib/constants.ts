/**
 * 프로젝트 전역에서 사용되는 사이트 및 기술적 상수 정의
 */

export const SITE_CONFIG = {
  name: "Community Boilerplate",
  description: "A highly scalable and customizable community platform solution.",
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  locale: "ko_KR",
  author: "Graylobo",
  keywords: ["community", "boilerplate", "nextjs", "nestjs", "forum"],
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
