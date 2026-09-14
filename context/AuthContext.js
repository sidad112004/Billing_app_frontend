import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/services/authApi';
import { saveTokens, clearTokens, getAccessToken, getRefreshToken } from '../api/client';
import { router } from 'expo-router';

const USER_DATA_KEY = 'auth_user_data';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        // Restore actual user object from persistent storage
        const userJson = await AsyncStorage.getItem(USER_DATA_KEY);
        if (userJson) {
          setUser(JSON.parse(userJson));
        } else {
          // Token exists but no user data – clear invalid session
          await clearTokens();
        }
      }
    } catch (error) {
      console.error('Session restoration failed:', error);
      await clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username, password, onResetTransaction) => {
    try {
      const response = await authApi.login(username, password);
      if (response.success) {
        const { accessToken, refreshToken, user: userData } = response.data;
        await saveTokens(accessToken, refreshToken);
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
        // Always clear any in-progress transaction from a previous session
        if (typeof onResetTransaction === 'function') onResetTransaction();
        setUser(userData);
        return { success: true };
      }
      return { success: false, error: response.message || 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Login failed due to network error' };
    }
  };

  const logout = async (onResetTransaction) => {
    try {
      if (typeof onResetTransaction === 'function') {
        try { onResetTransaction(); } catch (e) { /* ignore */ }
      }
      // Get refresh token to invalidate server-side session
      const refreshToken = await getRefreshToken().catch(() => null);
      if (refreshToken) {
        await authApi.logout(refreshToken).catch((e) => {
          console.warn('Backend logout failed, proceeding with local logout:', e);
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearTokens();
      await AsyncStorage.removeItem(USER_DATA_KEY);
      setUser(null);
      router.replace('/login');
    }
  };

  const createAccount = async ({ name, username, password, role, millName }) => {
    try {
      const response = await authApi.createAccount({ name, username, password, role, millName });
      if (response.success) {
        return { success: true, data: response.data, message: response.message };
      }
      return { success: false, error: response.message || 'Account creation failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Account creation failed due to network error' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, createAccount, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
