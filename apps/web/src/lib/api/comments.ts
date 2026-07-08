import { apiClient } from '../api-client';
import { CommentTree, CommentTargetType, CreateCommentDto, UpdateCommentDto } from '@community/shared-types';

export type { CommentTree, CommentTargetType, CreateCommentDto, UpdateCommentDto };

export const commentsApi = {
    getComments: async (
        targetType: CommentTargetType, 
        targetId: string,
        page: number = 1,
        limit: number = 100
    ): Promise<{ 
        comments: CommentTree[], 
        bestComments: CommentTree[], 
        total: number,
        pagination: {
            page: number;
            limit: number;
            totalRootCount: number;
            totalPages: number;
        }
    }> => {
        const response = await apiClient.get('/comments', {
            params: { targetType, targetId, page, limit }
        });
        return response.data;
    },

    getUserComments: async (
        userId: string,
        page: number = 1,
        limit: number = 20
    ): Promise<{ 
        items: any[], 
        total: number 
    }> => {
        const response = await apiClient.get(`/comments/user/${userId}`, {
            params: { page, limit }
        });
        return response.data;
    },

    createComment: async (data: CreateCommentDto) => {
        const response = await apiClient.post('/comments', data);
        return response.data;
    },

    updateComment: async (id: string, data: UpdateCommentDto) => {
        const response = await apiClient.patch(`/comments/${id}`, data);
        return response.data;
    },

    deleteComment: async (id: string, guestPassword?: string): Promise<{ success: true, commentCount?: number }> => {
        const response = await apiClient.delete(`/comments/${id}`, {
            data: { guestPassword }
        });
        return response.data;
    },

    toggleReaction: async (id: string, type: 'like' | 'dislike') => {
        const response = await apiClient.post(`/comments/${id}/reaction`, { type });
        return response.data;
    }
};
