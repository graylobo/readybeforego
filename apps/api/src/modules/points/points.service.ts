import { Injectable, OnModuleInit } from '@nestjs/common';
import { PointActionType } from '@community/shared-types';
import { PointsRepository } from './points.repository';

@Injectable()
export class PointsService implements OnModuleInit {
  constructor(
    private readonly pointsRepo: PointsRepository,
  ) {}

  async getMyPoints(userId: string) {
      let points = await this.pointsRepo.findUserPoints(userId);

      if (!points) {
          const [newPoints] = await this.pointsRepo.insertUserPoints({ userId });
          points = newPoints;
      } else {
          // 레벨 정합성 체크 및 동기화
          const correctLevel = this.calculateLevel(points.accumulatedPoints);
          if (points.level !== correctLevel) {
              const [updated] = await this.pointsRepo.updateUserPoints(userId, { level: correctLevel });
              points = updated;
          }
      }
      return points;
  }

  calculateLevel(accPoints: number): number {
      return Math.floor(Math.sqrt(accPoints / 100)) + 1;
  }

  async getHistory(userId: string) {
      return this.pointsRepo.findPointHistory(userId, 20);
  }

  // Core Logic: Award Points via Policy
  async awardPoints(userId: string, actionType: PointActionType, relatedId?: string, relatedType?: string) {
      const policy = await this.pointsRepo.findPointPolicy(actionType);

      if (!policy || (policy.experiencePoints === 0 && policy.availablePoints === 0)) return;

      // 2. Transaction: Update Points + Create History
      await this.pointsRepo.transaction(async (tx) => {
          // Update User Points
          const existing = await this.pointsRepo.findUserPoints(userId, tx);
          
          if (existing) {
              const newAccPoints = existing.accumulatedPoints + policy.experiencePoints;
              const newAvailablePoints = existing.availablePoints + policy.availablePoints;
              const newLevel = this.calculateLevel(newAccPoints);

              await this.pointsRepo.updateUserPoints(userId, {
                  accumulatedPoints: newAccPoints,
                  availablePoints: newAvailablePoints,
                  level: newLevel,
              }, tx);
          } else {
              const newLevel = this.calculateLevel(policy.experiencePoints);
              await this.pointsRepo.insertUserPoints({
                  userId,
                  accumulatedPoints: policy.experiencePoints,
                  availablePoints: policy.availablePoints,
                  level: newLevel,
              }, tx);
          }

          // Create History
          await this.pointsRepo.insertPointHistory({
              userId,
              points: policy.availablePoints || policy.experiencePoints, // Represent change, prefer available
              reason: policy.description || actionType,
              relatedId,
              relatedType,
          }, tx);
      });
  }
  async addPoints(userId: string, amount: number, reason: string, relatedId?: string, relatedType?: string, tx?: any) {
      if (amount <= 0) return;

      const db = tx ?? this.pointsRepo;

      // Update User Points
      const existing = await this.pointsRepo.findUserPoints(userId, tx);
      
      if (existing) {
          const newAvailablePoints = existing.availablePoints + amount;
          const newAccPoints = existing.accumulatedPoints + amount; // Typically selling also counts towards exp
          const newLevel = this.calculateLevel(newAccPoints);

          await this.pointsRepo.updateUserPoints(userId, {
              accumulatedPoints: newAccPoints,
              availablePoints: newAvailablePoints,
              level: newLevel,
          }, tx);
      } else {
          const newLevel = this.calculateLevel(amount);
          await this.pointsRepo.insertUserPoints({
              userId,
              accumulatedPoints: amount,
              availablePoints: amount,
              level: newLevel,
          }, tx);
      }

      // Create History
      await this.pointsRepo.insertPointHistory({
          userId,
          points: amount,
          reason,
          relatedId,
          relatedType,
      }, tx);
  }

  async deductPoints(userId: string, amount: number, reason: string, relatedId?: string, relatedType?: string, tx?: any) {
      if (amount <= 0) return true;

      const process = async (transaction: any) => {
          const existing = await this.pointsRepo.findUserPoints(userId, transaction);
          if (!existing || existing.availablePoints < amount) {
              return false; // Not enough points
          }

          const newAvailablePoints = existing.availablePoints - amount;

          await this.pointsRepo.updateUserPoints(userId, {
              availablePoints: newAvailablePoints,
          }, transaction);

          await this.pointsRepo.insertPointHistory({
              userId,
              points: -amount,
              reason,
              relatedId,
              relatedType,
          }, transaction);

          return true;
      };

      if (tx) {
          return await process(tx);
      } else {
          return await this.pointsRepo.transaction(process);
      }
  }
  async onModuleInit() {
      // Seed basic policies if empty
      const count = await this.pointsRepo.countPolicies();
      if (count === 0) {
          console.log('Seeding point policies...');
          await this.pointsRepo.insertPolicies([
              { actionType: PointActionType.POST_CREATED, experiencePoints: 10, availablePoints: 5, description: '게시글 작성' },
              { actionType: PointActionType.COMMENT_CREATED, experiencePoints: 2, availablePoints: 1, description: '댓글 작성' },
              { actionType: PointActionType.DAILY_LOGIN, experiencePoints: 5, availablePoints: 5, description: '일일 로그인' },
          ]);
      }
  }
}
