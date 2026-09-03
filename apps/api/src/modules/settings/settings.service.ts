import { Injectable } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { SiteSettings, UpdateSiteSettingsRequest } from '@community/shared-types';

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getSettings(): Promise<SiteSettings> {
    return this.toPublic(await this.settingsRepository.getSettings());
  }

  async updateSettings(data: UpdateSiteSettingsRequest): Promise<SiteSettings> {
    return this.toPublic(await this.settingsRepository.updateSettings(data));
  }

  private toPublic(row: {
    id: string;
    showSidebarAds: boolean;
    updatedAt: Date;
  }): SiteSettings {
    return {
      id: row.id,
      showSidebarAds: row.showSidebarAds,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
