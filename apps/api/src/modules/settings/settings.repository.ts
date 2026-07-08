import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { siteSettings } from '../../database/schema';
import * as schema from '../../database/schema';

@Injectable()
export class SettingsRepository {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getSettings() {
    let settings = await this.db.query.siteSettings.findFirst();
    if (!settings) {
      const [newSettings] = await this.db.insert(siteSettings).values({ showSidebarAds: true }).returning();
      settings = newSettings;
    }
    return settings;
  }

  async updateSettings(data: { showSidebarAds?: boolean }) {
    const current = await this.getSettings();
    const [updated] = await this.db.update(siteSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(siteSettings.id, current.id))
      .returning();
    return updated;
  }
}
