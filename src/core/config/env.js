const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const NODE_ENV = process.env.NODE_ENV || "development";
const environmentFile = `.env.${NODE_ENV}`;
const environmentPath = path.resolve(process.cwd(), environmentFile);

if (fs.existsSync(environmentPath)) {
  dotenv.config({ path: environmentPath });
} else {
  dotenv.config();
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parsePositiveInteger(value, fallback) {
  const parsed = parseInteger(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  if (typeof value === "undefined") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseCsv(value, fallback) {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const config = Object.freeze({
  NODE_ENV,
  PORT: parseInteger(process.env.PORT, 4000),
  API_PREFIX: process.env.API_PREFIX || "/api/v1",
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_MAX_RETRIES: parseInteger(process.env.MONGODB_MAX_RETRIES, 10),
  MONGODB_RETRY_DELAY_MS: parseInteger(
    process.env.MONGODB_RETRY_DELAY_MS,
    2000,
  ),
  CORS_ORIGINS: parseCsv(process.env.CORS_ORIGINS, [
    "http://localhost:3000",
    "http://localhost:19006",
  ]),
  RATE_LIMIT_WINDOW_MS: parseInteger(
    process.env.RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
  ),
  RATE_LIMIT_MAX: parsePositiveInteger(process.env.RATE_LIMIT_MAX, 300),
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  SHUTDOWN_TIMEOUT_MS: parseInteger(process.env.SHUTDOWN_TIMEOUT_MS, 10000),
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
  JWT_ISSUER: process.env.JWT_ISSUER || "march-food-delivery",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || "march-client-apps",
  BCRYPT_SALT_ROUNDS: parsePositiveInteger(process.env.BCRYPT_SALT_ROUNDS, 12),
  AUTH_LOGIN_WINDOW_MS: parsePositiveInteger(
    process.env.AUTH_LOGIN_WINDOW_MS,
    10 * 60 * 1000,
  ),
  AUTH_LOGIN_MAX_ATTEMPTS: parsePositiveInteger(
    process.env.AUTH_LOGIN_MAX_ATTEMPTS,
    10,
  ),
  EXPO_PUSH_ENABLED: parseBoolean(process.env.EXPO_PUSH_ENABLED, true),
  EXPO_PUSH_API_URL:
    process.env.EXPO_PUSH_API_URL || "https://exp.host/--/api/v2/push/send",
  EXPO_PUSH_ACCESS_TOKEN: process.env.EXPO_PUSH_ACCESS_TOKEN || null,
  EXPO_PUSH_BATCH_SIZE: parsePositiveInteger(process.env.EXPO_PUSH_BATCH_SIZE, 100),
  EXPO_PUSH_MAX_RETRIES: parseInteger(process.env.EXPO_PUSH_MAX_RETRIES, 1),
  EXPO_PUSH_RETRY_DELAY_MS: parsePositiveInteger(
    process.env.EXPO_PUSH_RETRY_DELAY_MS,
    500,
  ),
});

const requiredKeys = [
  "MONGODB_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];
const missingKeys = requiredKeys.filter((key) => !config[key]);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingKeys.join(", ")}`,
  );
}

module.exports = config;
