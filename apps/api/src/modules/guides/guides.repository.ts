import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, asc, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { CreateGuideZodDto, UpdateGuideZodDto } from './dto/guides.dto';

@Injectable()
export class GuidesRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByCountry(countryCode: string) {
    const guides = await this.db.query.countryGuides.findMany({
      where: eq(schema.countryGuides.countryCode, countryCode),
      orderBy: [asc(schema.countryGuides.sortOrder), asc(schema.countryGuides.createdAt)],
    });

    return {
      guides,
    };
  }

  async findAvailableCountries() {
    const results = await this.db
      .select({
        countryCode: schema.countryGuides.countryCode,
        countryName: schema.countries.name,
        countryNameEn: schema.countries.nameEn,
        count: sql<number>`count(${schema.countryGuides.id})::int`,
      })
      .from(schema.countryGuides)
      .innerJoin(schema.countries, eq(schema.countryGuides.countryCode, schema.countries.code))
      .groupBy(
        schema.countryGuides.countryCode,
        schema.countries.name,
        schema.countries.nameEn,
      );

    return results;
  }

  async createGuide(data: CreateGuideZodDto) {
    const [guide] = await this.db
      .insert(schema.countryGuides)
      .values(data)
      .returning();
    return guide;
  }

  async updateGuide(id: string, data: UpdateGuideZodDto) {
    const [updated] = await this.db
      .update(schema.countryGuides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.countryGuides.id, id))
      .returning();
    return updated;
  }

  async deleteGuide(id: string) {
    await this.db
      .delete(schema.countryGuides)
      .where(eq(schema.countryGuides.id, id));
    return { success: true };
  }
}
