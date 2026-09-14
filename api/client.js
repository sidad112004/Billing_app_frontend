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

  // Detect Expo Go host IP (development computer's local IP on Wi-Fi)
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  const hostIp = hostUri ? hostUri.split(':')[0] : null;

  if (hostIp) {
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
  refreshSubscribers.forEach(cb => cb(null, token));
  refreshSubscribers = [];
};

const onRefreshFailed = (err) => {
  refreshSubscribers.forEach(cb => cb(err, null));
  refreshSubscribers = [];
};

/**
 * Safely parse JSON from a response, falling back to text.
 */
const safeParseResponse = async (response) => {
  const text = await response.text();
  if (!text || !text.trim()) {
    return { success: response.ok, data: null };
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: response.ok,
      message: response.ok ? text : `Server Error (${response.status})`
    };
  }
};

const DEFAULT_TIMEOUT_MS = 20000; // 20s timeout for mobile networks

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

  // Setup timeout via AbortController
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    ...options,
    headers,
    signal: options.signal || controller.signal,
  };

  try {
    let response;
    try {
      response = await fetch(url, config);
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out. Please check your network connection.');
      }
      if (fetchError.message && (fetchError.message.includes('Network request failed') || fetchError.message.includes('Failed to fetch'))) {
        throw new Error('Network connection error. Please verify backend server and Wi-Fi connection.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle 401 Unauthorized (Token might be expired)
    if (response.status === 401 && !options.skipAuth && !options._retry) {
      if (isRefreshing) {
        // Wait for the active refresh to finish
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(async (err, newToken) => {
            if (err || !newToken) {
              return reject(err || new Error('Session expired'));
            }
            try {
              const retryHeaders = { ...headers, 'Authorization': `Bearer ${newToken}` };
              const retryRes = await fetch(url, { ...options, headers: retryHeaders, _retry: true });
              const retryData = await safeParseResponse(retryRes);
              if (!retryRes.ok) {
                throw new Error(retryData.message || 'API Request Failed');
              }
              resolve(retryData);
            } catch (retryErr) {
              reject(retryErr);
            }
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
          const refreshData = await safeParseResponse(refreshRes);

          if (refreshData.success && refreshData.data?.accessToken) {
            const newAccessToken = refreshData.data.accessToken;
            await saveTokens(newAccessToken, refreshToken);
            
            isRefreshing = false;
            onRefreshed(newAccessToken);

            // Retry original request
            config.headers['Authorization'] = `Bearer ${newAccessToken}`;
            config._retry = true;
            response = await fetch(url, config);
          } else {
            isRefreshing = false;
            onRefreshFailed(new Error('Session expired'));
            await clearTokens();
            throw new Error('Session expired');
          }
        } catch (refreshErr) {
          isRefreshing = false;
          onRefreshFailed(refreshErr);
          await clearTokens();
          throw refreshErr;
        }
      } else {
        isRefreshing = false;
        onRefreshFailed(new Error('Session expired'));
        await clearTokens();
        throw new Error('Session expired');
      }
    }

    const data = await safeParseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || `API Request Failed (${response.status})`);
    }

    return data;
  } catch (error) {
    console.error(`API Client Error (${endpoint}):`, error.message || error);
    throw error;
  }
};

export { apiClient, saveTokens, clearTokens, getAccessToken, getRefreshToken, API_BASE_URL };
