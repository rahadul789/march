import { Platform } from 'react-native';
import { publicApiClient, privateApiClient } from './httpClient';
import { unwrapApiData } from './apiResponse';
import { ApiRequestError, normalizeApiError } from '../errors/errorUtils';
import useAuthStore from '../../modules/auth/store/auth.store';
import useErrorStore from '../store/error.store';

const AUTH_ROUTES_WITHOUT_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

let isInitialized = false;
let refreshPromise = null;

function shouldSkipRefresh(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return AUTH_ROUTES_WITHOUT_REFRESH.some((path) => url.includes(path));
}

async function refreshAccessToken() {
  const authState = useAuthStore.getState();
  const refreshToken = authState.refreshToken;

  if (!refreshToken) {
    throw new ApiRequestError({
      message: 'Session expired. Please login again.',
      code: 'MISSING_REFRESH_TOKEN',
      statusCode: 401
    });
  }

  const response = await publicApiClient.post('/auth/refresh', {
    refreshToken,
    platform: Platform.OS,
    deviceType: Platform.OS
  });

  const result = unwrapApiData(response);
  if (!result?.tokens?.accessToken || !result?.tokens?.refreshToken) {
    throw new ApiRequestError({
      message: 'Invalid refresh response',
      code: 'INVALID_REFRESH_RESPONSE',
      statusCode: 500
    });
  }

  useAuthStore.getState().setAuthSession({
    user: result.user || authState.user,
    tokens: result.tokens
  });

  return result.tokens.accessToken;
}

async function invalidateSessionBeforeLogout() {
  const authState = useAuthStore.getState();
  const refreshToken = authState.refreshToken;

  if (!refreshToken) {
    return;
  }

  try {
    await publicApiClient.post('/auth/logout', { refreshToken });
  } catch (_error) {
    // Ignore logout endpoint failure during forced session cleanup.
  }
}

export function setupAuthInterceptors() {
  if (isInitialized) {
    return;
  }

  privateApiClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
      const nextHeaders = config.headers || {};
      nextHeaders.Authorization = `Bearer ${token}`;
      config.headers = nextHeaders;
    }

    return config;
  });

  privateApiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const normalizedError = normalizeApiError(error);
      const originalRequest = error.config || {};
      const shouldTryRefresh =
        normalizedError.statusCode === 401 &&
        !originalRequest._retry &&
        !shouldSkipRefresh(originalRequest.url);

      if (!shouldTryRefresh) {
        useErrorStore.getState().setGlobalError(normalizedError);
        throw normalizedError;
      }

      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const freshAccessToken = await refreshPromise;
        const nextHeaders = originalRequest.headers || {};
        nextHeaders.Authorization = `Bearer ${freshAccessToken}`;
        originalRequest.headers = nextHeaders;

        return privateApiClient(originalRequest);
      } catch (refreshError) {
        const normalizedRefreshError = normalizeApiError(refreshError);
        await invalidateSessionBeforeLogout();
        useAuthStore.getState().clearAuthSession();
        useErrorStore.getState().setGlobalError(normalizedRefreshError);
        throw normalizedRefreshError;
      }
    }
  );

  isInitialized = true;
}
