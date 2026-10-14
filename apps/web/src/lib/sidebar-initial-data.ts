import type { Board } from '@/lib/api/board';
import type { SiteSettings } from '@community/shared-types';
import { SITE_CONFIG } from '@/lib/constants';

/**
 * 사이드바 메뉴를 그리는 데 필요한 게시판 목록·사이트 설정을 서버에서 미리 받는다.
 * 페이지와 함께 내려보내 첫 화면부터 메뉴가 맞는 상태로 그려진다 (받기 전 기본값으로 그렸다가 바뀌며 깜빡이지 않게).
 * 60초마다 새로 받고, 화면이 뜬 뒤에는 브라우저가 최신 값을 다시 받아 맞춘다
 */
export interface SidebarInitialData {
  boards?: Board[];
  settings?: SiteSettings;
}

async function getData<T>(path: string): Promise<T | undefined> {
  try {
    const res = await fetch(`${SITE_CONFIG.apiUrl}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    const json = await res.json();
    return json?.data ?? undefined;
  } catch {
    // 못 받으면 예전처럼 브라우저에서 받는다
    return undefined;
  }
}

export async function getSidebarInitialData(): Promise<SidebarInitialData> {
  const [boards, settings] = await Promise.all([getData<Board[]>('/boards'), getData<SiteSettings>('/settings')]);
  return { boards, settings };
}
