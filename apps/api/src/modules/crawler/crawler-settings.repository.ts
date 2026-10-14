import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { crawlerSettings } from '../../database/schema';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';

@Injectable()
export class CrawlerSettingsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getSettings() {
    let settings = await this.db.query.crawlerSettings.findFirst();
    if (!settings) {
      const [created] = await this.db
        .insert(crawlerSettings)
        .values({ preservedTerms: null })
        .returning();
      settings = created;
    }
    return settings;
  }

  async updateSettings(data: { preservedTerms?: string | null }) {
    const current = await this.getSettings();
    const [updated] = await this.db
      .update(crawlerSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crawlerSettings.id, current.id))
      .returning();
    return updated;
  }
}
