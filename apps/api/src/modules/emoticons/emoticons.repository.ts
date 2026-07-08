import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';

export type Transaction = any;

@Injectable()
export class EmoticonsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(cb);
  }

  async createPack(authorId: string, data: any, tx?: Transaction) {
    const db = tx ?? this.db;
    const [pack] = await db.insert(schema.emoticonPacks).values({
      authorId,
      title: data.title,
      description: data.description,
      thumbnailUrl: data.thumbnailUrl,
      price: data.price,
      status: 'pending',
    }).returning();
    return pack;
  }

  async createEmoticons(packId: string, emoticonsData: any[], tx?: Transaction) {
    const db = tx ?? this.db;
    const values = emoticonsData.map(e => ({
      packId,
      url: e.url,
      name: e.name || null,
      order: e.order,
    }));
    return db.insert(schema.emoticons).values(values).returning();
  }

  async updatePack(id: string, data: any, status?: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const [updated] = await db.update(schema.emoticonPacks)
        .set({
            title: data.title,
            description: data.description,
            thumbnailUrl: data.thumbnailUrl,
            price: data.price,
            ...(status ? { status: status as any } : {}),
            updatedAt: new Date(),
        })
        .where(eq(schema.emoticonPacks.id, id))
        .returning();
    return updated;
  }

  async deleteEmoticons(packId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.delete(schema.emoticons).where(eq(schema.emoticons.packId, packId));
  }

  async findPackById(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    return db.query.emoticonPacks.findFirst({
        where: eq(schema.emoticonPacks.id, id),
        with: {
            emoticons: {
                orderBy: (emoticons, { asc }) => [asc(emoticons.order)],
            },
            author: {
                columns: { id: true, name: true, email: true },
            }
        }
    });
  }

  async searchPacks(
    whereClause: any,
    offset: number,
    limit: number,
    includeEmoticons = false,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    return db.query.emoticonPacks.findMany({
        where: whereClause,
        orderBy: [desc(schema.emoticonPacks.createdAt)],
        limit,
        offset,
        with: {
            author: { columns: { id: true, name: true } },
            ...(includeEmoticons ? {
                emoticons: {
                    orderBy: (emoticons: any, { asc }: any) => [asc(emoticons.order)],
                },
            } : {}),
        }
    });
  }

  async searchPacksBySales(
    whereClause: any,
    offset: number,
    limit: number,
    includeEmoticons = false,
    tx?: Transaction
  ) {
    const db = tx ?? this.db;
    return db.query.emoticonPacks.findMany({
        where: whereClause,
        orderBy: [desc(schema.emoticonPacks.salesCount), desc(schema.emoticonPacks.createdAt)],
        limit,
        offset,
        with: {
            author: { columns: { id: true, name: true } },
            ...(includeEmoticons ? {
                emoticons: {
                    orderBy: (emoticons: any, { asc }: any) => [asc(emoticons.order)],
                },
            } : {}),
        }
    });
  }

  async countPacks(whereClause: any, tx?: Transaction) {
    const db = tx ?? this.db;
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.emoticonPacks)
      .where(whereClause);
    return result?.count || 0;
  }

  async updatePackStatus(id: string, status: 'pending' | 'approved' | 'rejected', reason?: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const [updated] = await db.update(schema.emoticonPacks)
        .set({ status, rejectionReason: reason, updatedAt: new Date() })
        .where(eq(schema.emoticonPacks.id, id))
        .returning();
    return updated;
  }

  async updatePackPrice(id: string, price: number, tx?: Transaction) {
    const db = tx ?? this.db;
    const [updated] = await db.update(schema.emoticonPacks)
        .set({ price, updatedAt: new Date() })
        .where(eq(schema.emoticonPacks.id, id))
        .returning();
    return updated;
  }

  async deletePack(id: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const [deleted] = await db.update(schema.emoticonPacks)
        .set({ deletedAt: new Date() })
        .where(eq(schema.emoticonPacks.id, id))
        .returning();
    return deleted;
  }

  async restorePack(id: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const [restored] = await db.update(schema.emoticonPacks)
          .set({ deletedAt: null })
          .where(eq(schema.emoticonPacks.id, id))
          .returning();
      return restored;
  }

  async hasUserPurchased(userId: string, packId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    const purchased = await db.query.userEmoticonPacks.findFirst({
        where: and(
            eq(schema.userEmoticonPacks.userId, userId),
            eq(schema.userEmoticonPacks.packId, packId),
        )
    });
    return !!purchased;
  }

  async recordPurchase(userId: string, packId: string, tx?: Transaction) {
    const db = tx ?? this.db;
    
    // Increment total sales
    await db.update(schema.emoticonPacks)
        .set({ salesCount: sql`${schema.emoticonPacks.salesCount} + 1`, updatedAt: new Date() })
        .where(eq(schema.emoticonPacks.id, packId));

    // Record user purchase
    return db.insert(schema.userEmoticonPacks).values({
        userId,
        packId,
    });
  }

  async getUserPacks(userId: string, offset: number, limit: number, tx?: Transaction) {
    const db = tx ?? this.db;
    const result = await db.query.userEmoticonPacks.findMany({
        where: eq(schema.userEmoticonPacks.userId, userId),
        with: {
            pack: {
                with: {
                    emoticons: {
                        orderBy: (emoticons, { asc }) => [asc(emoticons.order)],
                    }
                }
            }
        },
        orderBy: [desc(schema.userEmoticonPacks.purchasedAt)],
        limit,
        offset,
    });
    return result;
  }

  async findPackByEmoticonUrl(url: string, tx?: Transaction) {
      const db = tx ?? this.db;
      const emoticon = await db.query.emoticons.findFirst({
          where: eq(schema.emoticons.url, url),
          with: {
              pack: {
                  with: {
                      author: {
                          columns: { id: true, name: true, email: true }
                      },
                      emoticons: {
                          orderBy: (emoticons, { asc }) => [asc(emoticons.order)],
                      }
                  }
              }
          }
      });
      return emoticon;
  }

  async findPurchasesByPackId(packId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.query.userEmoticonPacks.findMany({
          where: eq(schema.userEmoticonPacks.packId, packId)
      });
  }

  async deletePurchasesByPackId(packId: string, tx?: Transaction) {
      const db = tx ?? this.db;
      return db.delete(schema.userEmoticonPacks)
          .where(eq(schema.userEmoticonPacks.packId, packId));
  }
}
