import Constants from "expo-constants";

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

const extra = (Constants.expoConfig && Constants.expoConfig.extra) || {};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  extra.apiBaseUrl ||
  "http://192.168.1.9:4000/api/v1";

export const API_TIMEOUT_MS = parsePositiveInteger(
  process.env.EXPO_PUBLIC_API_TIMEOUT_MS || extra.apiTimeoutMs,
  15000,
);
