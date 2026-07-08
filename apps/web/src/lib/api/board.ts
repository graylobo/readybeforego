import { apiClient } from '../api-client';
import { Board, Post } from '@community/shared-types';
export type { Board, Post };

export const boardApi = {
    getBoards: async (): Promise<Board[]> => {
        const response = await apiClient.get('/boards');
        return response.data;
    },

    getBoard: async (slug: string): Promise<Board> => {
        const response = await apiClient.get(`/boards/${slug}`);
        return response.data;
    },

    getPosts: async (
        boardSlug?: string, 
        page = 1, 
        limit = 20,
        searchType?: string,
        searchQuery?: string,
        authorId?: string,
        isBest?: string,
        isNotice?: string
    ): Promise<{ items: Post[], total: number }> => {
        const response = await apiClient.get('/posts', {
            params: { board: boardSlug, page, limit, searchType, searchQuery, authorId, isBest, isNotice }
        });
        return response.data;
    },

    getPost: async (id: string, increment = false): Promise<Post> => {
        const response = await apiClient.get(`/posts/${id}`, {
            params: { increment: increment.toString() }
        });
        return response.data;
    },

    createPost: async (boardSlug: string, data: { 
        title: string; 
        content: string;
        category?: string;
        guestName?: string;
        guestPassword?: string; 
        isNotice?: boolean;
        isPinned?: boolean;
        isBest?: boolean;
        allowComments?: boolean;
        receiveCommentNotification?: boolean;
    }) => {
        const response = await apiClient.post('/posts', { ...data, boardSlug });
        return response.data;
    },

    deletePost: async (id: string, guestPassword?: string) => {
        await apiClient.delete(`/posts/${id}`, {
            data: { guestPassword }
        });
    },

    verifyPassword: async (id: string, password: string): Promise<boolean> => {
        const response = await apiClient.post(`/posts/${id}/verify-password`, { password });
        return response.data.isValid;
    },

    togglePostReaction: async (id: string, type: 'like' | 'dislike') => {
        const response = await apiClient.post(`/posts/${id}/reaction`, { type });
        return response.data;
    },

    updatePost: async (id: string, data: { 
        title: string; 
        content: string; 
        guestPassword?: string;
        isPinned?: boolean;
        isNotice?: boolean;
        isBest?: boolean;
        allowComments?: boolean;
        receiveCommentNotification?: boolean;
    }) => {
        const response = await apiClient.put(`/posts/${id}`, data);
        return response.data;
    },

    toggleScrap: async (id: string): Promise<{ isScrapped: boolean }> => {
        const response = await apiClient.post(`/posts/${id}/scrap`);
        return response.data;
    },

    getMyScrapped: async (page = 1, limit = 20): Promise<{ items: { post: Post; user: any; board: any }[], total: number }> => {
        const response = await apiClient.get('/posts/my/scrapped', {
            params: { page, limit }
        });
        return response.data;
    }
};
