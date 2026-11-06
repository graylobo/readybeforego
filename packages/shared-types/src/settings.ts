export type BoardViewMode = 'list' | 'lounge' | 'feed';

export interface SiteSettings {
  id: string;
  showSidebarAds: boolean;
  /** 사이드바에 '전체 게시판' 메뉴 표시 */
  showAllBoardMenu: boolean;
  /** 사이드바에 '게시판 목록' 메뉴 표시 */
  showBoardDirectoryMenu: boolean;
  /** 전체 게시판(/board/all)의 이름·설명·화면 형식 (DB 게시판이 아니라 사이트 설정에 둔다) */
  allBoardName: string;
  allBoardDescription: string;
  allBoardViewMode: BoardViewMode;
  updatedAt: string;
}

export interface UpdateSiteSettingsRequest {
  showSidebarAds?: boolean;
  showAllBoardMenu?: boolean;
  showBoardDirectoryMenu?: boolean;
  allBoardName?: string;
  allBoardDescription?: string;
  allBoardViewMode?: BoardViewMode;
}
