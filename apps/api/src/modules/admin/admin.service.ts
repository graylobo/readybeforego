import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { AdminRepository } from './admin.repository';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';
import { PointsService } from '../points/points.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly adminRepo: AdminRepository,
    private readonly pointsService: PointsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** 시스템 관리자가 회원에게 포인트 지급 (받은 회원에게 알림) */
  async grantPoints(
    adminId: string,
    userId: string,
    amount: number,
    reason: string,
  ) {
    const user = await this.adminRepo.findUserById(userId);
    if (!user)
      throw new ApiException(ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND);

    const points = await this.pointsService.grantByAdmin(
      userId,
      amount,
      reason,
      adminId,
    );
    this.logger.log(
      `[Point Grant] admin=${adminId} user=${userId} amount=${amount} reason=${reason}`,
    );

    await this.notificationsService
      .create({
        userId,
        type: 'SYSTEM',
        content: `[포인트 지급] 관리자가 ${amount.toLocaleString()}포인트를 지급했습니다. 사유: ${reason}`,
      })
      .catch((error) =>
        this.logger.warn(`[Point Grant] notification failed: ${error}`),
      );

    return points;
  }

  async warnUser(adminId: string, userId: string, reason: string) {
    const user = await this.adminRepo.findUserById(userId);
    if (!user) throw new ApiException(ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND);

    return await this.adminRepo.transaction(async (tx) => {
      const updatedUser = await this.adminRepo.incrementUserWarning(userId, tx);

      await this.adminRepo.insertModerationLog({
        userId,
        adminId,
        type: 'WARNING',
        reason,
      }, tx);

      return updatedUser;
    });
  }

  async suspendUser(adminId: string, userId: string, reason: string, days: number) {
    const user = await this.adminRepo.findUserById(userId);
    if (!user) throw new ApiException(ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND);

    const bannedUntil = new Date();
    bannedUntil.setDate(bannedUntil.getDate() + days);

    return await this.adminRepo.transaction(async (tx) => {
      const updatedUser = await this.adminRepo.suspendUser(userId, bannedUntil, tx);

      await this.adminRepo.insertModerationLog({
        userId,
        adminId,
        type: 'SUSPENSION',
        reason,
        durationDays: days,
      }, tx);

      return updatedUser;
    });
  }

  async banUser(adminId: string, userId: string, reason: string) {
    const user = await this.adminRepo.findUserById(userId);
    if (!user) throw new ApiException(ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND);

    return await this.adminRepo.transaction(async (tx) => {
      const updatedUser = await this.adminRepo.banUser(userId, tx);

      await this.adminRepo.insertModerationLog({
        userId,
        adminId,
        type: 'BAN',
        reason,
      }, tx);

      return updatedUser;
    });
  }

  async reactivateUser(adminId: string, userId: string, reason: string) {
    return await this.adminRepo.transaction(async (tx) => {
      const updatedUser = await this.adminRepo.reactivateUser(userId, tx);

      await this.adminRepo.insertModerationLog({
        userId,
        adminId,
        type: 'REACTIVATE',
        reason,
      }, tx);

      return updatedUser;
    });
  }

  async getModerationLogs(userId: string) {
    return this.adminRepo.findModerationLogsByUser(userId);
  }

  async getPointPolicies() {
    return this.adminRepo.findAllPointPolicies();
  }

  async updatePointPolicy(id: string, data: { experiencePoints?: number; availablePoints?: number; isActive?: boolean; description?: string }) {
    return await this.adminRepo.updatePointPolicy(id, data);
  }
}
