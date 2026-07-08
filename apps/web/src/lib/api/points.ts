import { apiClient } from "../api-client";

export interface UserPoints {
  accumulatedPoints: number;
  availablePoints: number;
  level: number;
}

export interface PointHistoryItem {
  id: string;
  points: number;
  reason: string;
  createdAt: string;
}

export const pointsApi = {
  getMyPoints: async (): Promise<UserPoints> => {
    const response = await apiClient.get('/points/me');
    return response.data;
  },

  getHistory: async (): Promise<PointHistoryItem[]> => {
    const response = await apiClient.get('/points/history');
    return response.data;
  },
};
