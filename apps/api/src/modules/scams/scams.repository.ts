import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, asc, desc, eq, sql, inArray, or, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { getKoreanCountryName, getCountryCode, getFlagEmoji } from '@community/shared-types';

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

    if (data.countryCode) {
      const code = getCountryCode(data.countryCode);
      const computedEmoji = getFlagEmoji(code);
      const nameKorean = getKoreanCountryName(code) || code;
      
      await db.insert(schema.countries).values({
        code,
        name: nameKorean,
        nameEn: code,
        emoji: computedEmoji,
        plug: '220V / 변환 어댑터',
        visa: '무비자 여부 확인',
        currency: `${code} 통화`,
        currencyCode: code,
      }).onConflictDoNothing();

      // data.countryCode를 표준 ISO 코드로 정규화
      data.countryCode = code;
    }

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
      where: eq(schema.scamInfos.id, id),
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

    // 1. 사전 동기 쿼리없이 SQL 서브쿼리를 이용해 단 1번의 쿼리로 병합
    const cityIdSubquery = db
      .select({ cityId: schema.regions.cityId })
      .from(schema.regions)
      .where(eq(schema.regions.id, regionId));

    const countryCodeSubquery = db
      .select({ countryCode: schema.cities.countryCode })
      .from(schema.regions)
      .innerJoin(schema.cities, eq(schema.regions.cityId, schema.cities.id))
      .where(eq(schema.regions.id, regionId));

    const whereConditions = [
      and(eq(schema.scamInfos.regionId, regionId), inArray(schema.scamInfos.scope, ['spot', 'region'])),
      and(inArray(schema.scamInfos.cityId, cityIdSubquery), eq(schema.scamInfos.scope, 'city')),
      and(inArray(schema.scamInfos.countryCode, countryCodeSubquery), eq(schema.scamInfos.scope, 'country')),
    ];

    const scams = await db.query.scamInfos.findMany({
      where: and(
        or(...whereConditions),
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

  async findByCity(
    cityId: string,
    userId?: string,
    ipAddress?: string,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;

    const countryCodeSubquery = db
      .select({ countryCode: schema.cities.countryCode })
      .from(schema.cities)
      .where(eq(schema.cities.id, cityId));

    const regionIdsSubquery = db
      .select({ id: schema.regions.id })
      .from(schema.regions)
      .where(eq(schema.regions.cityId, cityId));

    const whereConditions = [
      and(inArray(schema.scamInfos.regionId, regionIdsSubquery), inArray(schema.scamInfos.scope, ['spot', 'region'])),
      and(eq(schema.scamInfos.cityId, cityId), eq(schema.scamInfos.scope, 'city')),
      and(inArray(schema.scamInfos.countryCode, countryCodeSubquery), eq(schema.scamInfos.scope, 'country')),
    ];

    const scams = await db.query.scamInfos.findMany({
      where: and(
        or(...whereConditions),
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
    const cityIdsSubquery = db.select({ id: schema.cities.id })
      .from(schema.cities)
      .where(eq(schema.cities.countryCode, countryCode));

    const regionIdsSubquery = db.select({ id: schema.regions.id })
      .from(schema.regions)
      .leftJoin(schema.cities, eq(schema.regions.cityId, schema.cities.id))
      .where(eq(schema.cities.countryCode, countryCode));

    const whereConditions = [
      and(inArray(schema.scamInfos.regionId, regionIdsSubquery), inArray(schema.scamInfos.scope, ['spot', 'region'])),
      and(inArray(schema.scamInfos.cityId, cityIdsSubquery), eq(schema.scamInfos.scope, 'city')),
      and(eq(schema.scamInfos.countryCode, countryCode), eq(schema.scamInfos.scope, 'country')),
    ];

    const scams = await db.query.scamInfos.findMany({
      where: and(
        or(...whereConditions),
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

  async findReactions(
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
      return [];
    }

    return db.query.scamInfoReactions.findMany({
      where: whereClause,
    });
  }

  async deleteAllReactionsByUser(
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
      return [];
    }

    return db.delete(schema.scamInfoReactions).where(whereClause).returning();
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
    const countriesList = await db.select().from(schema.countries).orderBy(asc(schema.countries.name));
    return countriesList.map(c => ({
      ...c,
      name: getKoreanCountryName(c.code || c.name),
    }));
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
      cautionCount: sql<number>`count(case when ${schema.scamInfos.reportType} = 'CAUTION' then 1 end)::int`,
      tipCount: sql<number>`count(case when ${schema.scamInfos.reportType} = 'TIP' then 1 end)::int`,
      hasRegionScope: sql<boolean>`coalesce(bool_or(${schema.scamInfos.scope} = 'region'), false)`,
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

  async findRegionById(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.regions.findFirst({
      where: eq(schema.regions.id, id),
    });
  }

  async findCityById(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.cities.findFirst({
      where: eq(schema.cities.id, id),
    });
  }

  async findRegionByName(name: string, cityId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.regions.findFirst({
      where: and(
        eq(schema.regions.name, name),
        eq(schema.regions.cityId, cityId)
      ),
    });
  }

  async findDuplicateScam(title: string, countryCode: string, cityId?: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const trimmedTitle = title.trim();

    const conditions: SQL[] = [
      eq(schema.scamInfos.title, trimmedTitle),
      eq(schema.scamInfos.countryCode, countryCode),
      sql`${schema.scamInfos.deletedAt} is null`,
    ];

    if (cityId) {
      conditions.push(eq(schema.scamInfos.cityId, cityId));
    }

    return db.query.scamInfos.findFirst({
      where: and(...conditions),
    });
  }

  async findAdminScams(params: {
    page: number;
    limit: number;
    search?: string;
    scope?: string;
    countryCode?: string;
    cityId?: string;
    scamCategory?: string;
    includeDeleted?: boolean;
  }) {
    const { page, limit, search, scope, countryCode, cityId, scamCategory, includeDeleted } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (!includeDeleted) {
      conditions.push(sql`${schema.scamInfos.deletedAt} is null`);
    }

    if (scope && scope !== 'all') {
      conditions.push(eq(schema.scamInfos.scope, scope as any));
    }
    if (countryCode && countryCode !== 'all') {
      conditions.push(eq(schema.scamInfos.countryCode, countryCode));
    }
    if (cityId && cityId !== 'all') {
      conditions.push(eq(schema.scamInfos.cityId, cityId));
    }
    if (scamCategory && scamCategory !== 'all') {
      conditions.push(eq(schema.scamInfos.scamCategory, scamCategory));
    }
    if (search && search.trim()) {
      const queryStr = `%${search.trim()}%`;
      conditions.push(
        or(
          sql`${schema.scamInfos.title} ILIKE ${queryStr}`,
          sql`${schema.scamInfos.description} ILIKE ${queryStr}`
        )!
      );
    }

    const whereClause = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.scamInfos)
      .where(whereClause);

    const items = await this.db.query.scamInfos.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(schema.scamInfos.createdAt)],
      with: {
        region: true,
        city: true,
        country: true,
      },
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findByIds(ids: string[], tx?: Transaction) {
    if (!ids || ids.length === 0) return [];
    const db = tx ?? this.db;
    return db.query.scamInfos.findMany({
      where: inArray(schema.scamInfos.id, ids),
    });
  }

  async deleteAdminScam(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db
      .delete(schema.scamInfos)
      .where(eq(schema.scamInfos.id, id))
      .returning();
    return result;
  }

  async deleteAdminScamsBulk(ids: string[], tx?: Transaction) {
    if (!ids || ids.length === 0) return [];
    const db = tx ?? this.db;
    return db
      .delete(schema.scamInfos)
      .where(inArray(schema.scamInfos.id, ids))
      .returning();
  }

  async findCommentImagesByScam(scamId: string, tx?: Transaction): Promise<string[]> {
    const db = tx ?? this.db;
    const commentsList = await db.select({
      imageUrl: schema.comments.imageUrl,
      content: schema.comments.content,
    })
    .from(schema.comments)
    .where(and(
      eq(schema.comments.targetId, scamId),
      eq(schema.comments.targetType, 'scam_info'),
      isNull(schema.comments.deletedAt)
    ));

    const imageUrls: string[] = [];
    for (const c of commentsList) {
      if (c.imageUrl) {
        imageUrls.push(c.imageUrl);
      }
      if (c.content) {
        const matches = c.content.match(/<img[^>]+src=["']([^"']+)["']/g);
        if (matches) {
          for (const match of matches) {
            const srcMatch = match.match(/src=["']([^"']+)["']/);
            if (srcMatch && srcMatch[1]) {
              imageUrls.push(srcMatch[1]);
            }
          }
        }
      }
    }
    return imageUrls;
  }

  async softDeleteCommentsByScam(scamId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    await db.update(schema.comments)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(schema.comments.targetId, scamId),
        eq(schema.comments.targetType, 'scam_info'),
        isNull(schema.comments.deletedAt)
      ));
  }
}
