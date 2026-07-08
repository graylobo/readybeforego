export type LayoutMode = "sidebar" | "top";

export const LAYOUT_MODE_COOKIE = "layout-mode";
const LEGACY_LAYOUT_STORAGE_KEY = "layout-storage";

export function parseLayoutMode(value?: string | null): LayoutMode {
  return value === "top" ? "top" : "sidebar";
}

/** 서버/클라이언트 공통 — 쿠키 값을 레이아웃 모드로 파싱 */
export function getLayoutModeFromCookies(
  cookieValue?: string | null,
): LayoutMode {
  return parseLayoutMode(cookieValue);
}

/** 클라이언트에서 레이아웃 모드 변경 시 쿠키 동기화 */
export function writeLayoutModeCookie(mode: LayoutMode) {
  if (typeof document === "undefined") return;
  document.cookie = `${LAYOUT_MODE_COOKIE}=${mode};path=/;max-age=31536000;SameSite=Lax`;
}

/**
 * next-themes처럼 React 하이드레이션 전에 data-layout을 붙이는 블로킹 스크립트.
 * 쿠키가 없으면 기존 localStorage(layout-storage) 값으로 1회 마이그레이션한다.
 */
export const layoutModeBootstrapScript = `(function(){try{var mode="sidebar";var m=document.cookie.match(/(?:^|;)\\s*${LAYOUT_MODE_COOKIE}=([^;]*)/);if(m){mode=decodeURIComponent(m[1]);}else{var raw=localStorage.getItem("${LEGACY_LAYOUT_STORAGE_KEY}");if(raw){var parsed=JSON.parse(raw);var stored=parsed&&parsed.state&&parsed.state.layoutMode;if(stored==="top"||stored==="sidebar"){mode=stored;document.cookie="${LAYOUT_MODE_COOKIE}="+mode+";path=/;max-age=31536000;SameSite=Lax";}}}if(mode!=="top"&&mode!=="sidebar"){mode="sidebar";}document.documentElement.setAttribute("data-layout",mode);}catch(e){document.documentElement.setAttribute("data-layout","sidebar");}})();`;
