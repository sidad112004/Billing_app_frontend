import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const formatBaseUrl = (url) => {
  if (!url) return '';
  let formatted = url.trim().replace(/\/+$/, '');
  if (!formatted.endsWith('/api')) {
    formatted = `${formatted}/api`;
  }
  return formatted;
};

const getApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // If environment variable is explicitly provided, use it
  if (envUrl) {
    return formatBaseUrl(envUrl);
  }

  // On Web, use localhost
  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  // Detect Expo Go host IP (your development computer's local IP on Wi-Fi)
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  const hostIp = hostUri ? hostUri.split(':')[0] : null;

  if (hostIp) {
    console.log(`[API Client] Auto-detected Expo Host IP: ${hostIp}`);
    return `http://${hostIp}:5000/api`;
  }

  // Fallback for Android emulator
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAccessToken = async () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('accessToken') : null;
  }
  return await SecureStore.getItemAsync('accessToken');
};

const getRefreshToken = async () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('refreshToken') : null;
  }
  return await SecureStore.getItemAsync('refreshToken');
};

const saveTokens = async (accessToken, refreshToken) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('accessToken', accessToken);
      if (refreshToken) window.localStorage.setItem('refreshToken', refreshToken);
    }
  } else {
    await SecureStore.setItemAsync('accessToken', accessToken);
    if (refreshToken) await SecureStore.setItemAsync('refreshToken', refreshToken);
  }
};

const clearTokens = async () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('accessToken');
      window.localStorage.removeItem('refreshToken');
    }
  } else {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  }
};

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token) => {
  refreshSubscribers.map(cb => cb(token));
  refreshSubscribers = [];
};

const apiClient = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  let token = await getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    let response = await fetch(url, config);

    // Handle 401 Unauthorized (Token might be expired)
    if (response.status === 401 && !options.skipAuth && !options._retry) {
      if (isRefreshing) {
        // Wait for the refresh to finish
        return new Promise(resolve => {
          subscribeTokenRefresh(newToken => {
            config.headers['Authorization'] = `Bearer ${newToken}`;
            config._retry = true;
            resolve(fetch(url, config).then(res => res.json()));
          });
        });
      }

      isRefreshing = true;
      const refreshToken = await getRefreshToken();

      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          const refreshData = await refreshRes.json();

          if (refreshData.success && refreshData.data.accessToken) {
            const newAccessToken = refreshData.data.accessToken;
            await saveTokens(newAccessToken, refreshToken); // Keep old refresh token
            
            isRefreshing = false;
            onRefreshed(newAccessToken);

            // Retry original request
            config.headers['Authorization'] = `Bearer ${newAccessToken}`;
            config._retry = true;
            response = await fetch(url, config);
          } else {
            // Refresh failed
            isRefreshing = false;
            await clearTokens();
            // In a real app, you might want to dispatch a logout event here
            throw new Error('Session expired');
          }
        } catch (refreshErr) {
          isRefreshing = false;
          await clearTokens();
          throw refreshErr;
        }
      } else {
        isRefreshing = false;
        await clearTokens();
        throw new Error('Session expired');
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'API Request Failed');
    }

    return data;
  } catch (error) {
    console.error(`API Client Error (${endpoint}):`, error);
    throw error;
  }
};

export { apiClient, saveTokens, clearTokens, getAccessToken, getRefreshToken, API_BASE_URL };
