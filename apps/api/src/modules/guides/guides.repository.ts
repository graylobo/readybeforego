import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray, ne, asc, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { CreateGuideZodDto, UpdateGuideZodDto } from './dto/guides.dto';

@Injectable()
export class GuidesRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByCountry(countryCode: string, includeCommon: boolean = true) {
    const whereClause = includeCommon
      ? inArray(schema.countryGuides.countryCode, Array.from(new Set([countryCode, 'ALL'])))
      : eq(schema.countryGuides.countryCode, countryCode);

    const guides = await this.db.query.countryGuides.findMany({
      where: whereClause,
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
      .where(ne(schema.countryGuides.countryCode, 'ALL'))
      .groupBy(
        schema.countryGuides.countryCode,
        schema.countries.name,
        schema.countries.nameEn,
      );

    return results;
  }

  async findAll() {
    const guides = await this.db.query.countryGuides.findMany({
      orderBy: [asc(schema.countryGuides.countryCode), asc(schema.countryGuides.sortOrder), asc(schema.countryGuides.createdAt)],
    });

    return {
      guides,
    };
  }

  async createGuide(data: CreateGuideZodDto) {
    const [guide] = await this.db
      .insert(schema.countryGuides)
      .values(data)
      .returning();
    return guide;
  }

  async createGuidesBulk(items: any[]) {
    if (!items || items.length === 0) return { count: 0 };
    const inserted = await this.db
      .insert(schema.countryGuides)
      .values(items)
      .returning();
    return { count: inserted.length };
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

  async deleteGuides(ids: string[]) {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    await this.db
      .delete(schema.countryGuides)
      .where(inArray(schema.countryGuides.id, ids));
    return { success: true, count: ids.length };
  }
}
