import { apiClient } from '../client';

export const authApi = {
  login: async (username, password) => {
    return await apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    });
  },

  createAccount: async ({ name, username, password, role, millName }) => {
    return await apiClient('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, password, role, millName }),
      skipAuth: true,
    });
  },

  logout: async (refreshToken) => {
    return await apiClient('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};
