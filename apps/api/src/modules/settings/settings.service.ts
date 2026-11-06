import { Injectable } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { BoardViewMode, SiteSettings, UpdateSiteSettingsRequest } from '@community/shared-types';
import { siteSettings } from '../../database/schema';

// 사이트 설정은 거의 바뀌지 않는데 전체 게시판 목록 요청마다 읽으므로 서버 메모리에 잠깐 들고 있는다.
// 관리자가 바꾸면 해당 서버는 즉시 비우고, 서버가 여러 대면 다른 서버는 최대 이 시간 뒤 반영된다 (게시판 캐시와 같은 방식)
const SETTINGS_CACHE_TTL_MS = 5_000;

@Injectable()
export class SettingsService {
  private cache: { value: SiteSettings; expiresAt: number } | null = null;
  private loading: Promise<SiteSettings> | null = null;

  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getSettings(): Promise<SiteSettings> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    // 동시에 여러 요청이 와도 DB 조회는 한 번만
    if (!this.loading) {
      this.loading = this.settingsRepository
        .getSettings()
        .then((row) => {
          const value = this.toPublic(row);
          this.cache = { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
          return value;
        })
        .finally(() => {
          this.loading = null;
        });
    }
    return this.loading;
  }

  async updateSettings(data: UpdateSiteSettingsRequest): Promise<SiteSettings> {
    const value = this.toPublic(await this.settingsRepository.updateSettings(data));
    this.cache = { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    return value;
  }

  private toPublic(row: typeof siteSettings.$inferSelect): SiteSettings {
    return {
      id: row.id,
      showSidebarAds: row.showSidebarAds,
      showAllBoardMenu: row.showAllBoardMenu,
      showBoardDirectoryMenu: row.showBoardDirectoryMenu,
      allBoardName: row.allBoardName,
      allBoardDescription: row.allBoardDescription,
      allBoardViewMode: row.allBoardViewMode as BoardViewMode,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
