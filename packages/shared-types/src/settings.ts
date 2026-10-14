export interface SiteSettings {
  id: string;
  showSidebarAds: boolean;
  /** 사이드바에 '전체 게시판' 메뉴 표시 */
  showAllBoardMenu: boolean;
  /** 사이드바에 '게시판 목록' 메뉴 표시 */
  showBoardDirectoryMenu: boolean;
  updatedAt: string;
}

export interface UpdateSiteSettingsRequest {
  showSidebarAds?: boolean;
  showAllBoardMenu?: boolean;
  showBoardDirectoryMenu?: boolean;
}
