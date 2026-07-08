import { CreateEmoticonPackDto, ErrorCode, isAdmin, UpdateEmoticonPackDto, UpdateEmoticonPackStatusDto } from '@community/shared-types';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../../common/exceptions/api.exception';
import { and, eq, ilike, sql } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { PointsService } from '../points/points.service';
import { EmoticonsRepository } from './emoticons.repository';

@Injectable()
export class EmoticonsService {
  constructor(
    private readonly emoticonsRepo: EmoticonsRepository,
    private readonly pointsService: PointsService,
  ) {}

  async create(userId: string, data: CreateEmoticonPackDto) {
    return this.emoticonsRepo.transaction(async (tx) => {
      // Create pack
      const pack = await this.emoticonsRepo.createPack(userId, data, tx);

      // Create emoticon items
      await this.emoticonsRepo.createEmoticons(pack.id, data.emoticons, tx);

      return pack;
    });
  }

  async update(id: string, userId: string, data: UpdateEmoticonPackDto) {
    const pack = await this.findOne(id);

    if (pack.authorId !== userId) {
        throw new ApiException(ErrorCode.FORBIDDEN_ACTION, HttpStatus.FORBIDDEN);
    }

    // If already approved/rejected, set back to pending for re-review
    const status = pack.status === 'pending' ? undefined : 'pending';

    return this.emoticonsRepo.transaction(async (tx) => {
        // Update pack info
        const updatedPack = await this.emoticonsRepo.updatePack(id, data, status, tx);

        // Update emoticons: delete and re-insert
        await this.emoticonsRepo.deleteEmoticons(id, tx);
        await this.emoticonsRepo.createEmoticons(id, data.emoticons, tx);

        return updatedPack;
    });
  }

  async findAll(page: number = 1, limit: number = 20, status?: string, q?: string, sortBy: 'latest' | 'sales' = 'sales') {
    const offset = (page - 1) * limit;

    let whereClause: any;
    
    if (status === 'discontinued') {
        whereClause = and(
            sql`${schema.emoticonPacks.deletedAt} IS NOT NULL`,
            q ? ilike(schema.emoticonPacks.title, `%${q}%`) : undefined
        );
    } else {
        const targetStatus = status ?? 'approved';
        whereClause = and(
            eq(schema.emoticonPacks.status, targetStatus as any),
            sql`${schema.emoticonPacks.deletedAt} IS NULL`,
            q ? ilike(schema.emoticonPacks.title, `%${q}%`) : undefined
        );
    }

    const [items, total] = await Promise.all([
        sortBy === 'sales'
            ? this.emoticonsRepo.searchPacksBySales(whereClause, offset, limit, true)
            : this.emoticonsRepo.searchPacks(whereClause, offset, limit, true),
        this.emoticonsRepo.countPacks(whereClause)
    ]);

    return { items, total };
  }

  async findOne(id: string) {
    const pack = await this.emoticonsRepo.findPackById(id);
    if (!pack) {
        throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return pack;
  }

  async purchase(userId: string, packId: string) {
    const pack = await this.findOne(packId);

    if (pack.status !== 'approved') {
        throw new ApiException(ErrorCode.FORBIDDEN_ACTION, HttpStatus.BAD_REQUEST, 'This emoticon pack is not available for purchase');
    }

    if (pack.authorId === userId) {
        throw new ApiException(ErrorCode.FORBIDDEN_ACTION, HttpStatus.BAD_REQUEST, 'You cannot purchase your own emoticon pack');
    }

    return this.emoticonsRepo.transaction(async (tx) => {
        // Check if already purchased
        const hasPurchased = await this.emoticonsRepo.hasUserPurchased(userId, packId, tx);
        if (hasPurchased) {
            throw new ApiException(ErrorCode.EMOTICON_ALREADY_PURCHASED);
        }

        // Deduct points from buyer
        if (pack.price > 0) {
            const success = await this.pointsService.deductPoints(userId, pack.price, `Purchased emoticon pack: ${pack.title}`, pack.id, 'EMOTICON_PACK', tx);
            if (!success) {
                throw new ApiException(ErrorCode.NOT_ENOUGH_POINTS);
            }

            // Award points to author
            await this.pointsService.addPoints(pack.authorId, pack.price, `Sold emoticon pack: ${pack.title}`, pack.id, 'EMOTICON_PACK', tx);
        }

        // Record purchase
        await this.emoticonsRepo.recordPurchase(userId, packId, tx);

        return { success: true };
    });
  }

  async getMyPacks(userId: string, page: number = 1, limit: number = 20) {
      const offset = (page - 1) * limit;
      const items = await this.emoticonsRepo.getUserPacks(userId, offset, limit);
      // count could be added if needed, skipping for simple implementation
      return { items, total: items.length }; 
  }

  async getMyCreatedPacks(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const whereClause = eq(schema.emoticonPacks.authorId, userId);

    const [items, total] = await Promise.all([
        this.emoticonsRepo.searchPacks(whereClause, offset, limit, true),
        this.emoticonsRepo.countPacks(whereClause)
    ]);

    return { items, total };
  }

  async updateStatus(id: string, dto: UpdateEmoticonPackStatusDto) {
      const pack = await this.findOne(id);
      return this.emoticonsRepo.updatePackStatus(id, dto.status, dto.rejectionReason);
  }
  async remove(id: string, userId: string, userRole: string) {
      const pack = await this.findOne(id);

      if (pack.authorId !== userId && !isAdmin(userRole as any)) {
          throw new ApiException(ErrorCode.FORBIDDEN_ACTION, HttpStatus.FORBIDDEN);
      }

      await this.emoticonsRepo.deletePack(id);
      return { success: true };
  }

  async restore(id: string, userId: string, userRole: string) {
      const pack = await this.emoticonsRepo.findPackById(id);
      if (!pack) {
          throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
      }

      if (pack.authorId !== userId && !isAdmin(userRole as any)) {
          throw new ApiException(ErrorCode.FORBIDDEN_ACTION, HttpStatus.FORBIDDEN);
      }

      await this.emoticonsRepo.restorePack(id);
      return { success: true };
  }

  async findByUrl(url: string) {
      const emoticon = await this.emoticonsRepo.findPackByEmoticonUrl(url);
      if (!emoticon) {
          throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND, 'Emoticon not found');
      }
      return emoticon;
  }

  async updatePrice(id: string, price: number) {
      await this.findOne(id);
      return this.emoticonsRepo.updatePackPrice(id, price);
  }

  async forceDeleteWithRefund(id: string) {
      const pack = await this.findOne(id);
      
      return this.emoticonsRepo.transaction(async (tx) => {
          // 1. Find all purchasers
          const purchasers = await this.emoticonsRepo.findPurchasesByPackId(id, tx);
          
          if (pack.price > 0 && purchasers.length > 0) {
              const totalRefund = pack.price * purchasers.length;

              // 2. Refund each purchaser
              for (const p of purchasers) {
                  await this.pointsService.addPoints(
                      p.userId, 
                      pack.price, 
                      `Refund: Emoticon pack removed due to policy violation (${pack.title})`, 
                      id, 
                      'EMOTICON_PACK', 
                      tx
                  );
              }

              // 3. Deduct from author (total sales amount)
              await this.pointsService.deductPoints(
                  pack.authorId, 
                  totalRefund, 
                  `Profit clawback: Emoticon pack removed due to policy violation (${pack.title})`, 
                  id, 
                  'EMOTICON_PACK', 
                  tx
              );
          }

          // 4. Delete all purchase records
          await this.emoticonsRepo.deletePurchasesByPackId(id, tx);

          // 5. Hard delete the pack (or mark as deleted)
          await this.emoticonsRepo.deletePack(id, tx);

          return { success: true, refundedCount: purchasers.length };
      });
  }
}
