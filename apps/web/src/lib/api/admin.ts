import { apiClient } from '../api-client';
import { UserRole } from '@community/shared-types';

export type DashboardRangeDays = 1 | 7 | 30;

export interface DashboardMetric {
    total: number;
    /** 이번 기간에 새로 생긴 수 */
    current: number;
    /** 지난 기간(같은 길이, 같은 시점까지)에 새로 생긴 수 */
    previous: number;
    /** 날짜별 새로 생긴 수 (range.seriesDates 순서) */
    series: number[];
}

export type DashboardSystemState = 'ok' | 'warning' | 'error' | 'idle';

export interface DashboardSystem {
    key: string;
    state: DashboardSystemState;
    message: string;
    checkedAt: string | null;
}

export interface DashboardModerationLog {
    id: string;
    type: string;
    reason: string;
    durationDays: number | null;
    createdAt: string;
    user: { id: string; name: string } | null;
    admin: { id: string; name: string } | null;
}

/** 관리자 대시보드 지표 (글·댓글은 봇이 등록한 것을 뺀 수) */
export interface AdminDashboard {
    range: { days: DashboardRangeDays; start: string; seriesDates: string[] };
    metrics: {
        users: DashboardMetric;
        posts: DashboardMetric;
        comments: DashboardMetric;
        boards: { total: number; active: number; current: number };
    };
    topBoards: Array<{ id: string; name: string; slug: string; postCount: number }>;
    recentModerationLogs: DashboardModerationLog[];
    systems: DashboardSystem[];
}

/** 관리자가 처리할 일 */
export interface DashboardTask {
    key: string;
    count: number;
    oldestAt: string | null;
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
    getDashboard: async (days: DashboardRangeDays): Promise<AdminDashboard> => {
        const response = await apiClient.get('/admin/dashboard', { params: { days } });
        return response.data;
    },

    getDashboardTasks: async (): Promise<DashboardTask[]> => {
        const response = await apiClient.get('/admin/dashboard/tasks');
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

    /** 시스템 관리자가 회원에게 포인트 지급 (사용 가능 포인트) */
    grantPoints: async (id: string, amount: number, reason: string) => {
        const response = await apiClient.post(`/admin/users/${id}/points`, { amount, reason });
        return response.data as { availablePoints: number };
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
