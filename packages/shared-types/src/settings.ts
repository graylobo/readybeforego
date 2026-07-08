export interface SiteSettings {
  id: string;
  showSidebarAds: boolean;
  updatedAt: string;
}

export interface UpdateSiteSettingsRequest {
  showSidebarAds?: boolean;
}
