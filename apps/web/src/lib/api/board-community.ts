import { apiClient } from '../api-client';
import type {
  Board,
  BoardManager,
  BoardRequest,
  CreateBoardRequestDto,
  ReviewBoardRequestDto,
} from '@community/shared-types';

/** 게시판 목록 페이지의 한 줄 */
export interface BoardDirectoryItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: 'system' | 'user';
  isReadOnly: boolean;
  createdAt: string;
  postCount: number;
  managerName: string | null;
}

/**
 * 게시판 개설 신청과 게시판 관리자(매니저·부매니저) API
 */
export const boardCommunityApi = {
  getDirectory: async (q?: string): Promise<BoardDirectoryItem[]> => {
    const response = await apiClient.get('/boards/directory', { params: { q: q || undefined } });
    return response.data;
  },

  createRequest: async (dto: CreateBoardRequestDto): Promise<BoardRequest> => {
    const response = await apiClient.post('/boards/requests', dto);
    return response.data;
  },

  getMyRequests: async (): Promise<BoardRequest[]> => {
    const response = await apiClient.get('/boards/requests/my');
    return response.data;
  },

  getManagers: async (slug: string): Promise<BoardManager[]> => {
    const response = await apiClient.get(`/boards/${encodeURIComponent(slug)}/managers`);
    return response.data;
  },

  addSubManager: async (slug: string, name: string): Promise<BoardManager[]> => {
    const response = await apiClient.post(`/boards/${encodeURIComponent(slug)}/sub-managers`, { name });
    return response.data;
  },

  removeSubManager: async (slug: string, userId: string): Promise<BoardManager[]> => {
    const response = await apiClient.delete(`/boards/${encodeURIComponent(slug)}/sub-managers/${userId}`);
    return response.data;
  },

  updateSettings: async (slug: string, settings: { description?: string; showManagers?: boolean }): Promise<Board> => {
    const response = await apiClient.patch(`/boards/${encodeURIComponent(slug)}/settings`, settings);
    return response.data;
  },

  // ---- 사이트 관리자 ----

  getRequests: async (status?: string, page = 1): Promise<{ items: BoardRequest[]; total: number }> => {
    const response = await apiClient.get('/boards/admin/requests', { params: { status: status || undefined, page } });
    return response.data;
  },

  reviewRequest: async (id: string, dto: ReviewBoardRequestDto): Promise<BoardRequest> => {
    const response = await apiClient.patch(`/boards/admin/requests/${id}`, dto);
    return response.data;
  },

  changeManager: async (boardId: string, name: string): Promise<BoardManager[]> => {
    const response = await apiClient.put(`/boards/admin/${boardId}/manager`, { name });
    return response.data;
  },

  deleteBoardWithPosts: async (boardId: string): Promise<{ deletedPosts: number }> => {
    const response = await apiClient.delete(`/boards/admin/${boardId}/with-posts`);
    return response.data;
  },
};
