import { apiClient } from '../api-client';
import { UserRole } from '@community/shared-types';

export interface AdminDashboardStats {
    users: { total: number; today: number };
    boards: number;
    posts: { total: number; today: number };
    comments: { total: number; today: number };
    topBoards: Array<{ id: string; name: string; slug: string; postCount: number }>;
    recentModerationLogs: any[];
}

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: string;
    bannedUntil?: string;
    warningCount: number;
    createdAt: string;
}

export interface ModerationLog {
    id: string;
    userId: string;
    adminId: string;
    type: string;
    reason: string;
    durationDays?: number;
    createdAt: string;
    admin: {
        id: string;
        name: string;
        picture?: string;
    };
}

export interface PointPolicy {
    id: string;
    actionType: string;
    experiencePoints: number;
    availablePoints: number;
    description?: string;
    isActive: boolean;
    updatedAt: string;
}

export const adminApi = {
    getDashboard: async (): Promise<AdminDashboardStats> => {
        const response = await apiClient.get('/admin/dashboard');
        return response.data;
    },

    getUsers: async (search?: string): Promise<AdminUser[]> => {
        const response = await apiClient.get('/admin/users', { 
            params: { search } 
        });
        return response.data;
    },

    getModerationLogs: async (id: string): Promise<ModerationLog[]> => {
        const response = await apiClient.get(`/admin/users/${id}/moderation-logs`);
        return response.data;
    },

    updateUserRole: async (id: string, role: UserRole): Promise<AdminUser> => {
        const response = await apiClient.patch(`/admin/users/${id}/role`, { role });
        return response.data;
    },

    warnUser: async (id: string, reason: string): Promise<AdminUser> => {
        const response = await apiClient.post(`/admin/users/${id}/warn`, { reason });
        return response.data;
    },

    suspendUser: async (id: string, reason: string, days: number): Promise<AdminUser> => {
        const response = await apiClient.post(`/admin/users/${id}/suspend`, { reason, days });
        return response.data;
    },

    banUser: async (id: string, reason: string): Promise<AdminUser> => {
        const response = await apiClient.post(`/admin/users/${id}/ban`, { reason });
        return response.data;
    },

    reactivateUser: async (id: string, reason: string): Promise<AdminUser> => {
        const response = await apiClient.post(`/admin/users/${id}/reactivate`, { reason });
        return response.data;
    },

    getBoards: async (): Promise<any[]> => {
        const response = await apiClient.get('/boards/admin/all');
        return response.data.boards;
    },

    createBoard: async (data: any): Promise<any> => {
        const response = await apiClient.post('/boards/admin', data);
        return response.data.board;
    },

    updateBoard: async (id: string, data: any): Promise<any> => {
        const response = await apiClient.patch(`/boards/admin/${id}`, data);
        return response.data.board;
    },

    deleteBoard: async (id: string): Promise<void> => {
        await apiClient.delete(`/boards/admin/${id}`);
    },

    getPointPolicies: async (): Promise<PointPolicy[]> => {
        const response = await apiClient.get('/admin/points/policies');
        return response.data;
    },

    updatePointPolicy: async (id: string, data: Partial<PointPolicy>): Promise<PointPolicy> => {
        const response = await apiClient.patch(`/admin/points/policies/${id}`, data);
        return response.data;
    }
};
