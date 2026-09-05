import { Injectable } from '@nestjs/common';
import { ChatSettings, UpdateChatSettingsRequest } from '@community/shared-types';
import { ChatSettingsRepository } from './chat-settings.repository';

const CHAT_SETTINGS_CACHE_MS = 5_000;

@Injectable()
export class ChatSettingsService {
  private cache: { value: ChatSettings; at: number } | null = null;

  constructor(private readonly chatSettingsRepo: ChatSettingsRepository) {}

  async getSettings(): Promise<ChatSettings> {
    if (this.cache && Date.now() - this.cache.at < CHAT_SETTINGS_CACHE_MS) {
      return this.cache.value;
    }
    const row = await this.chatSettingsRepo.getSettings();
    const value = this.toPublic(row);
    this.cache = { value, at: Date.now() };
    return value;
  }

  async updateSettings(data: UpdateChatSettingsRequest): Promise<ChatSettings> {
    const updated = await this.chatSettingsRepo.updateSettings(data);
    const value = this.toPublic(updated);
    this.cache = { value, at: Date.now() };
    return value;
  }

  async isEnabled(): Promise<boolean> {
    return (await this.getSettings()).enabled;
  }

  async isPersistEnabled(): Promise<boolean> {
    return (await this.getSettings()).persistEnabled;
  }

  private toPublic(row: {
    enabled: boolean;
    persistEnabled: boolean;
    showOnlineCount: boolean;
    showMessageTime: boolean;
    defaultOpen: boolean;
    updatedAt: Date;
  }): ChatSettings {
    return {
      enabled: row.enabled,
      persistEnabled: row.persistEnabled,
      showOnlineCount: row.showOnlineCount,
      showMessageTime: row.showMessageTime,
      defaultOpen: row.defaultOpen,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
