import { apiClient } from "../api-client";
import { User } from "@community/shared-types";
export type { User };

export const authApi = {
  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },
};
