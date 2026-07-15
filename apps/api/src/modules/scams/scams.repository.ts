import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, asc, desc, eq, sql, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';

export type Transaction = any;

@Injectable()
export class ScamsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async create(data: typeof schema.scamInfos.$inferInsert, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db.insert(schema.scamInfos).values(data).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof schema.scamInfos.$inferInsert>, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db
      .update(schema.scamInfos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.scamInfos.id, id))
      .returning();
    return result;
  }

  async findById(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const scam = await db.query.scamInfos.findFirst({
      where: and(eq(schema.scamInfos.id, id), sql`${schema.scamInfos.deletedAt} is null`),
      with: {
        region: {
          with: {
            city: {
              with: {
                country: true,
              },
            },
          },
        },
      },
    });
    if (!scam) return null;

    const [commentCountRes] = await db.select({
      count: sql<number>`count(${schema.comments.id})::int`
    })
    .from(schema.comments)
    .where(and(
      eq(schema.comments.targetType, 'scam_info'),
      eq(schema.comments.targetId, id),
      sql`${schema.comments.deletedAt} is null`
    ));

    return {
      ...scam,
      commentCount: commentCountRes?.count || 0
    };
  }

  private async attachCommentCounts(scams: any[], db: any) {
    if (scams.length === 0) return [];
    const scamIds = scams.map(s => s.id);
    const commentCounts = await db.select({
      targetId: schema.comments.targetId,
      count: sql<number>`count(${schema.comments.id})::int`,
    })
    .from(schema.comments)
    .where(and(
      eq(schema.comments.targetType, 'scam_info'),
      inArray(schema.comments.targetId, scamIds),
      sql`${schema.comments.deletedAt} is null`
    ))
    .groupBy(schema.comments.targetId);

    const countsMap = new Map(commentCounts.map((c: any) => [c.targetId, c.count]));
    return scams.map(s => ({
      ...s,
      commentCount: countsMap.get(s.id) || 0,
    }));
  }

  async findByRegion(
    regionId: string,
    userId?: string,
    ipAddress?: string,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    const scams = await db.query.scamInfos.findMany({
      where: and(eq(schema.scamInfos.regionId, regionId), sql`${schema.scamInfos.deletedAt} is null`),
      orderBy: [desc(schema.scamInfos.upvoteCount), desc(schema.scamInfos.createdAt)],
      with: {
        reactions: userId
          ? {
              where: eq(schema.scamInfoReactions.userId, userId),
            }
          : ipAddress
          ? {
              where: and(
                sql`${schema.scamInfoReactions.userId} is null`,
                eq(schema.scamInfoReactions.ipAddress, ipAddress)
              ),
            }
          : undefined,
      },
    });
    return this.attachCommentCounts(scams, db);
  }

  async findByCity(
    cityId: string,
    userId?: string,
    ipAddress?: string,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    const regionIdsSubquery = db.select({ id: schema.regions.id })
      .from(schema.regions)
      .where(eq(schema.regions.cityId, cityId));

    const scams = await db.query.scamInfos.findMany({
      where: and(
        inArray(schema.scamInfos.regionId, regionIdsSubquery),
        sql`${schema.scamInfos.deletedAt} is null`
      ),
      orderBy: [desc(schema.scamInfos.upvoteCount), desc(schema.scamInfos.createdAt)],
      with: {
        reactions: userId
          ? {
              where: eq(schema.scamInfoReactions.userId, userId),
            }
          : ipAddress
          ? {
              where: and(
                sql`${schema.scamInfoReactions.userId} is null`,
                eq(schema.scamInfoReactions.ipAddress, ipAddress)
              ),
            }
          : undefined,
      },
    });
    return this.attachCommentCounts(scams, db);
  }

  async findByCountry(
    countryCode: string,
    userId?: string,
    ipAddress?: string,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    const regionIdsSubquery = db.select({ id: schema.regions.id })
      .from(schema.regions)
      .leftJoin(schema.cities, eq(schema.regions.cityId, schema.cities.id))
      .where(eq(schema.cities.countryCode, countryCode));

    const scams = await db.query.scamInfos.findMany({
      where: and(
        inArray(schema.scamInfos.regionId, regionIdsSubquery),
        sql`${schema.scamInfos.deletedAt} is null`
      ),
      orderBy: [desc(schema.scamInfos.upvoteCount), desc(schema.scamInfos.createdAt)],
      with: {
        reactions: userId
          ? {
              where: eq(schema.scamInfoReactions.userId, userId),
            }
          : ipAddress
          ? {
              where: and(
                sql`${schema.scamInfoReactions.userId} is null`,
                eq(schema.scamInfoReactions.ipAddress, ipAddress)
              ),
            }
          : undefined,
      },
    });
    return this.attachCommentCounts(scams, db);
  }

  async findReaction(
    scamInfoId: string,
    userId?: string,
    ipAddress?: string,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    let whereClause;
    
    if (userId) {
      whereClause = and(
        eq(schema.scamInfoReactions.scamInfoId, scamInfoId),
        eq(schema.scamInfoReactions.userId, userId)
      );
    } else if (ipAddress) {
      whereClause = and(
        eq(schema.scamInfoReactions.scamInfoId, scamInfoId),
        sql`${schema.scamInfoReactions.userId} is null`,
        eq(schema.scamInfoReactions.ipAddress, ipAddress)
      );
    } else {
      return null;
    }

    return db.query.scamInfoReactions.findFirst({
      where: whereClause,
    });
  }

  async addReaction(
    data: typeof schema.scamInfoReactions.$inferInsert,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    const [result] = await db.insert(schema.scamInfoReactions).values(data).returning();
    return result;
  }

  async updateReaction(
    id: string,
    type: 'like' | 'dislike',
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    const [result] = await db
      .update(schema.scamInfoReactions)
      .set({ type })
      .where(eq(schema.scamInfoReactions.id, id))
      .returning();
    return result;
  }

  async deleteReaction(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    await db.delete(schema.scamInfoReactions).where(eq(schema.scamInfoReactions.id, id));
  }

  async recalculateReactionCounts(scamInfoId: string, tx?: Transaction) {
    const db = tx ?? this.db;

    const [upvoteRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.scamInfoReactions)
      .where(
        and(
          eq(schema.scamInfoReactions.scamInfoId, scamInfoId),
          eq(schema.scamInfoReactions.type, 'like')
        )
      );

    const [downvoteRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.scamInfoReactions)
      .where(
        and(
          eq(schema.scamInfoReactions.scamInfoId, scamInfoId),
          eq(schema.scamInfoReactions.type, 'dislike')
        )
      );

    await db
      .update(schema.scamInfos)
      .set({
        upvoteCount: upvoteRes.count,
        downvoteCount: downvoteRes.count,
      })
      .where(eq(schema.scamInfos.id, scamInfoId));
  }

  async findAllCountries(tx?: Transaction) {
    const db = tx ?? this.db;
    return db.select().from(schema.countries).orderBy(asc(schema.countries.name));
  }

  async findCitiesByCountry(countryCode: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.select()
      .from(schema.cities)
      .where(eq(schema.cities.countryCode, countryCode))
      .orderBy(asc(schema.cities.name));
  }

  async findRegionsByCity(cityId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.select()
      .from(schema.regions)
      .where(eq(schema.regions.cityId, cityId))
      .orderBy(asc(schema.regions.name));
  }

  async findAllRegions(tx?: Transaction) {
    const db = tx ?? this.db;
    return db.select({
      id: schema.regions.id,
      cityId: schema.regions.cityId,
      name: schema.regions.name,
      nameEn: schema.regions.nameEn,
      latitude: schema.regions.latitude,
      longitude: schema.regions.longitude,
      cityName: schema.cities.name,
      countryCode: schema.cities.countryCode,
      scamCount: sql<number>`count(${schema.scamInfos.id})::int`,
    })
    .from(schema.regions)
    .leftJoin(schema.cities, eq(schema.regions.cityId, schema.cities.id))
    .leftJoin(
      schema.scamInfos,
      and(
        eq(schema.scamInfos.regionId, schema.regions.id),
        sql`${schema.scamInfos.deletedAt} is null`
      )
    )
    .groupBy(
      schema.regions.id,
      schema.regions.cityId,
      schema.regions.name,
      schema.regions.nameEn,
      schema.regions.latitude,
      schema.regions.longitude,
      schema.cities.name,
      schema.cities.countryCode
    )
    .orderBy(schema.regions.name);
  }

  async createRegion(data: typeof schema.regions.$inferInsert, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db.insert(schema.regions).values(data).returning();
    return result;
  }

  async findCountryByName(name: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.countries.findFirst({
      where: eq(schema.countries.name, name),
    });
  }

  async findCountryByCode(code: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.countries.findFirst({
      where: eq(schema.countries.code, code),
    });
  }

  async createCountry(data: typeof schema.countries.$inferInsert, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db.insert(schema.countries).values(data).returning();
    return result;
  }

  async findCityByName(name: string, countryCode: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.cities.findFirst({
      where: and(
        eq(schema.cities.name, name),
        eq(schema.cities.countryCode, countryCode)
      ),
    });
  }

  async createCity(data: typeof schema.cities.$inferInsert, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db.insert(schema.cities).values(data).returning();
    return result;
  }
}
