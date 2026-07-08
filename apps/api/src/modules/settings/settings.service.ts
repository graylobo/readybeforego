import { Injectable } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { UpdateSiteSettingsRequest } from '@community/shared-types';

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getSettings() {
    return this.settingsRepository.getSettings();
  }

  async updateSettings(data: UpdateSiteSettingsRequest) {
    return this.settingsRepository.updateSettings(data);
  }
}
