import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '../api-client';
import { CommentTree, CommentTargetType, CreateCommentDto, UpdateCommentDto } from '@community/shared-types';

export type { CommentTree, CommentTargetType, CreateCommentDto, UpdateCommentDto };

// 댓글 한 페이지에 보여줄 (최상위) 댓글 수. 서버 렌더링과 브라우저가 같은 값을 써야 첫 페이지를 재사용할 수 있다
export const COMMENT_PAGE_LIMIT = 30;

export interface CommentListData {
    comments: CommentTree[];
    bestComments: CommentTree[];
    total: number;
    pagination: {
        page: number;
        limit: number;
        totalRootCount: number;
        totalPages: number;
    };
}

export const commentsApi = {
    getComments: async (
        targetType: CommentTargetType,
        targetId: string,
        page: number = 1,
        limit: number = 100,
        config?: AxiosRequestConfig,
    ): Promise<CommentListData> => {
        const response = await apiClient.get('/comments', {
            ...config,
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

    // 작성한 댓글을 목록과 같은 형태로 돌려받아, 목록을 다시 불러오지 않고 바로 끼워 넣는다
    createComment: async (data: CreateCommentDto): Promise<{ comment: CommentTree; commentCount?: number }> => {
        const response = await apiClient.post('/comments', data);
        return response.data;
    },

    updateComment: async (id: string, data: UpdateCommentDto) => {
        const response = await apiClient.patch(`/comments/${id}`, data);
        return response.data;
    },

    deleteComment: async (id: string, guestPassword?: string, deleteMode: 'soft' | 'hard' = 'soft'): Promise<{ success: true, commentCount?: number }> => {
        const response = await apiClient.delete(`/comments/${id}`, {
            data: { guestPassword, deleteMode },
            params: { deleteMode },
        });
        return response.data;
    },

    toggleReaction: async (id: string, type: 'like' | 'dislike'): Promise<{ userReaction: 'like' | 'dislike' | null; upvoteCount: number; downvoteCount: number }> => {
        const response = await apiClient.post(`/comments/${id}/reaction`, { type });
        return response.data;
    }
};
