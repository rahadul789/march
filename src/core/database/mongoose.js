const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../logger/logger');
const sleep = require('../../shared/utils/sleep');

const readyStateMap = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

function calculateRetryDelay(attempt) {
  const baseDelay = env.MONGODB_RETRY_DELAY_MS;
  const exponentialDelay = baseDelay * (2 ** Math.min(attempt - 1, 5));
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(exponentialDelay + jitter, 30000);
}

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established');
});

mongoose.connection.on('reconnected', () => {
  logger.warn('MongoDB connection re-established');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
});

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB connection error', { message: error.message });
});

async function connectWithRetry() {
  let attempt = 0;
  const maxRetries = env.MONGODB_MAX_RETRIES;

  while (true) {
    attempt += 1;

    try {
      await mongoose.connect(env.MONGODB_URI, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      });

      logger.info('MongoDB connected successfully', { attempt });
      return;
    } catch (error) {
      const retryDelayMs = calculateRetryDelay(attempt);

      logger.error('MongoDB connection attempt failed', {
        attempt,
        maxRetries,
        retryDelayMs,
        message: error.message
      });

      if (maxRetries > 0 && attempt >= maxRetries) {
        throw error;
      }

      await sleep(retryDelayMs);
    }
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}

function getDatabaseHealth() {
  return {
    state: readyStateMap[mongoose.connection.readyState] || 'unknown',
    name: mongoose.connection.name || null,
    host: mongoose.connection.host || null
  };
}

module.exports = {
  connectWithRetry,
  disconnectDatabase,
  getDatabaseHealth
};
