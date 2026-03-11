import { Platform } from 'react-native';
import { publicApiClient, privateApiClient } from '../../../core/api/httpClient';
import { unwrapApiData } from '../../../core/api/apiResponse';
import { normalizeApiError } from '../../../core/errors/errorUtils';

function buildDevicePayload(context = {}) {
  return {
    platform: Platform.OS,
    deviceType: Platform.OS,
    deviceId: context.deviceId || null,
    pushToken: context.pushToken || null
  };
}

export async function register(payload) {
  try {
    const response = await publicApiClient.post('/auth/register', {
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
      role: 'user'
    });

    return unwrapApiData(response);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function login(payload) {
  try {
    const response = await publicApiClient.post('/auth/login', {
      identifier: payload.identifier,
      password: payload.password,
      ...buildDevicePayload(payload)
    });

    return unwrapApiData(response);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function refreshTokens(payload) {
  try {
    const response = await publicApiClient.post('/auth/refresh', {
      refreshToken: payload.refreshToken,
      ...buildDevicePayload(payload)
    });

    return unwrapApiData(response);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function logout(payload) {
  try {
    const response = await publicApiClient.post('/auth/logout', {
      refreshToken: payload.refreshToken
    });

    return unwrapApiData(response);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getMe() {
  try {
    const response = await privateApiClient.get('/auth/me');
    return unwrapApiData(response);
  } catch (error) {
    throw normalizeApiError(error);
  }
}
