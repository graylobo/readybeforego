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
          await this.pointsRepo.applyPointsDelta(userId, policy.experiencePoints, policy.availablePoints, tx);

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

  /**
   * 글/댓글로 받은 포인트를 되돌린다. 지급 기록이 있고 아직 회수하지 않았을 때 한 번만.
   * 이미 써버린 포인트는 남은 만큼만 빼고 0 아래로 내리지 않는다 (금액은 현재 정책 기준)
   */
  async revokePoints(userId: string, actionType: PointActionType, relatedId: string, relatedType: string) {
      const policy = await this.pointsRepo.findPointPolicy(actionType);
      if (!policy || (policy.experiencePoints === 0 && policy.availablePoints === 0)) return;

      await this.pointsRepo.transaction(async (tx) => {
          const history = await this.pointsRepo.findHistoryByRelated(userId, relatedId, relatedType, tx);
          const awarded = history.some((h: { points: number }) => h.points > 0);
          const revoked = history.some((h: { points: number }) => h.points < 0);
          if (!awarded || revoked) return;

          await this.pointsRepo.applyPointsDelta(userId, -policy.experiencePoints, -policy.availablePoints, tx);
          await this.pointsRepo.insertPointHistory({
              userId,
              points: -(policy.availablePoints || policy.experiencePoints),
              reason: `${policy.description || actionType} 회수 (삭제)`,
              relatedId,
              relatedType,
          }, tx);
      });
  }

  async addPoints(userId: string, amount: number, reason: string, relatedId?: string, relatedType?: string, tx?: any) {
      if (amount <= 0) return;

      // Typically selling also counts towards exp
      await this.pointsRepo.applyPointsDelta(userId, amount, amount, tx);

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
          // 잔액 확인과 차감을 한 번에 (동시에 두 번 구매해도 잔액 이상 쓰지 못함)
          if (!(await this.pointsRepo.deductAvailablePoints(userId, amount, transaction))) {
              return false; // Not enough points
          }

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
