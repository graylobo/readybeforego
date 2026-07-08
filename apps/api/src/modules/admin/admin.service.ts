import { Injectable, HttpStatus } from '@nestjs/common';
import { AdminRepository } from './admin.repository';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepo: AdminRepository,
  ) {}

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usersCount = await this.adminRepo.countTotalUsers();
    const todayUsersCount = await this.adminRepo.countTodayUsers(today);
    
    const boardsCount = await this.adminRepo.countTotalBoards();
    
    const postsCount = await this.adminRepo.countTotalPosts();
    const todayPostsCount = await this.adminRepo.countTodayPosts(today);
    
    const commentsCount = await this.adminRepo.countTotalComments();
    const todayCommentsCount = await this.adminRepo.countTodayComments(today);

    const topBoards = await this.adminRepo.getTopBoards(5);
    const recentModerationLogs = await this.adminRepo.getRecentModerationLogs(5);

    return {
      users: {
        total: usersCount,
        today: todayUsersCount,
      },
      boards: boardsCount,
      posts: {
        total: postsCount,
        today: todayPostsCount,
      },
      comments: {
        total: commentsCount,
        today: todayCommentsCount,
      },
      topBoards,
      recentModerationLogs,
    };
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
