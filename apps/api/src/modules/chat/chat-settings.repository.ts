import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { chatSettings } from '../../database/schema';
import * as schema from '../../database/schema';

@Injectable()
export class ChatSettingsRepository {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getSettings() {
    let settings = await this.db.query.chatSettings.findFirst();
    if (!settings) {
      const [created] = await this.db
        .insert(chatSettings)
        .values({
          enabled: true,
          persistEnabled: true,
          showOnlineCount: false,
          showMessageTime: false,
          defaultOpen: true,
        })
        .returning();
      settings = created;
    }
    return settings;
  }

  async updateSettings(data: {
    enabled?: boolean;
    persistEnabled?: boolean;
    showOnlineCount?: boolean;
    showMessageTime?: boolean;
    defaultOpen?: boolean;
  }) {
    const current = await this.getSettings();
    const [updated] = await this.db
      .update(chatSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chatSettings.id, current.id))
      .returning();
    return updated;
  }
}
