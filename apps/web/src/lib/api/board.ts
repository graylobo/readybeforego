import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '../api-client';
import { Board, Post } from '@community/shared-types';
export type { Board, Post };

export interface BoardPageParams {
    page?: number;
    limit?: number;
    searchType?: string;
    searchQuery?: string;
}

/** 게시판 화면 데이터: 게시판 정보 + (첫 페이지면) 공지/인기글 + 게시글 목록 */
export interface BoardPageData {
    board: Board;
    notices: Post[];
    best: Post[];
    posts: { items: Post[]; total: number };
}

/** 사이트맵에 넣을 글 하나 (사람이 쓴 공개 글) */
export interface SitemapPostEntry {
    id: string;
    boardSlug: string;
    updatedAt: string;
}

export const boardApi = {
    getSitemapSummary: async (): Promise<{ total: number; chunkSize: number }> => {
        const response = await apiClient.get('/posts/sitemap/summary');
        return response.data;
    },

    getSitemapChunk: async (chunk: number): Promise<SitemapPostEntry[]> => {
        const response = await apiClient.get(`/posts/sitemap/chunk/${chunk}`);
        return response.data;
    },

    getBoards: async (): Promise<Board[]> => {
        const response = await apiClient.get('/boards');
        return response.data;
    },

    getBoard: async (slug: string, config?: AxiosRequestConfig): Promise<Board> => {
        const response = await apiClient.get(`/boards/${slug}`, config);
        return response.data;
    },

    // 게시판 화면에 필요한 데이터를 한 번의 요청으로 받는다 (게시판/공지/인기글/목록을 각각 요청하지 않음)
    getBoardPage: async (slug: string, params: BoardPageParams, config?: AxiosRequestConfig): Promise<BoardPageData> => {
        const response = await apiClient.get(`/posts/board-page/${encodeURIComponent(slug)}`, {
            ...config,
            params: {
                page: params.page,
                limit: params.limit,
                searchType: params.searchQuery ? params.searchType : undefined,
                searchQuery: params.searchQuery || undefined,
            },
        });
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
        isNotice?: string,
        includeContent?: boolean
    ): Promise<{ items: Post[], total: number }> => {
        const response = await apiClient.get('/posts', {
            params: { board: boardSlug, page, limit, searchType, searchQuery, authorId, isBest, isNotice, includeContent }
        });
        return response.data;
    },

    // 상세 응답에는 게시판 정보 전체가 함께 온다 (게시판을 따로 요청하지 않아도 됨)
    getPost: async (id: string, config?: AxiosRequestConfig): Promise<Post & { board: Board }> => {
        const response = await apiClient.get(`/posts/${id}`, config);
        return response.data;
    },

    // 조회수 +1 (상세 화면은 서버 렌더링 결과를 그대로 쓰고 조회수만 따로 기록)
    recordView: async (id: string): Promise<{ viewCount: number }> => {
        const response = await apiClient.post(`/posts/${id}/view`);
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

    /** 게시글 비공개/공개 전환 (Super Admin) */
    setPostHidden: async (id: string, hidden: boolean): Promise<{ hiddenAt: string | null }> => {
        const response = await apiClient.put(`/posts/${id}/hidden`, { hidden });
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
