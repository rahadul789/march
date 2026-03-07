const env = require("../../../core/config/env");
const logger = require("../../../core/logger/logger");
const deviceService = require("../../device/service");

const EXPO_PUSH_URL =
  env.EXPO_PUSH_API_URL || "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_LIMIT = Math.min(
  Math.max(env.EXPO_PUSH_BATCH_SIZE || 100, 1),
  100,
);
const EXPO_MAX_RETRIES = Math.max(env.EXPO_PUSH_MAX_RETRIES || 1, 0);
const EXPO_RETRY_DELAY_MS = Math.max(env.EXPO_PUSH_RETRY_DELAY_MS || 500, 0);

function isExpoPushToken(token) {
  if (typeof token !== "string") {
    return false;
  }

  const normalized = token.trim();
  return (
    /^ExponentPushToken\[[^\]]+\]$/.test(normalized) ||
    /^ExpoPushToken\[[^\]]+\]$/.test(normalized)
  );
}

function chunkArray(items, chunkSize) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// কোন notification কোন device-এ যাবে সেটার final payload বানায়।
function buildExpoMessages(notifications, devices) {
  const deviceMap = new Map();

  for (const device of devices) {
    if (!device || !device.userId || !isExpoPushToken(device.pushToken)) {
      continue;
    }

    const key = String(device.userId);
    if (!deviceMap.has(key)) {
      deviceMap.set(key, []);
    }

    deviceMap.get(key).push(device);
  }

  const messages = [];

  for (const notification of notifications) {
    const userId = String(notification.userId);
    const userDevices = deviceMap.get(userId) || [];

    for (const device of userDevices) {
      messages.push({
        notificationId: notification.id,
        userId,
        pushToken: device.pushToken,
        sessionId: device.sessionId,
        expoMessage: {
          to: device.pushToken,
          title: notification.title,
          body: notification.message,
          priority: "high",
          sound: "default",
          data: {
            notificationId: notification.id,
            type: notification.type,
            ...notification.payload,
          },
        },
      });
    }
  }

  return messages;
}

async function sendExpoBatch(batchMessages) {
  const payload = batchMessages.map((entry) => entry.expoMessage);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (env.EXPO_PUSH_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}`;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Expo push API failed with ${response.status}: ${body}`);
  }

  const responseJson = await response.json();
  const tickets = Array.isArray(responseJson.data) ? responseJson.data : [];

  if (tickets.length !== batchMessages.length) {
    throw new Error("Expo push API ticket count mismatch");
  }

  return tickets;
}

async function sendExpoBatchWithRetry(batchMessages) {
  let attempt = 0;

  while (attempt <= EXPO_MAX_RETRIES) {
    try {
      const tickets = await sendExpoBatch(batchMessages);
      return { tickets, attemptsUsed: attempt + 1 };
    } catch (error) {
      if (attempt >= EXPO_MAX_RETRIES) {
        throw error;
      }

      attempt += 1;
      logger.warn("Expo push batch failed, retrying", {
        attempt,
        maxRetries: EXPO_MAX_RETRIES,
        errorMessage: error.message,
      });
      await sleep(EXPO_RETRY_DELAY_MS);
    }
  }

  return { tickets: [], attemptsUsed: attempt + 1 };
}

function isInvalidTokenError(errorCode) {
  return [
    "DeviceNotRegistered",
    "InvalidCredentials",
    "MismatchSenderId",
  ].includes(String(errorCode || ""));
}

async function dispatchExpoPushNotifications(notifications, eventPayload = {}) {
  if (!env.EXPO_PUSH_ENABLED) {
    return {
      dispatched: false,
      reason: "EXPO_PUSH_DISABLED",
    };
  }

  if (!Array.isArray(notifications) || notifications.length === 0) {
    return {
      dispatched: false,
      reason: "NO_NOTIFICATIONS",
    };
  }

  const targetUserIds = Array.from(
    new Set(notifications.map((item) => String(item.userId))),
  );
  const devices =
    await deviceService.getActivePushDevicesByUserIds(targetUserIds);
  const messages = buildExpoMessages(notifications, devices);

  if (messages.length === 0) {
    logger.info("Expo push skipped: no active push devices", {
      notificationCount: notifications.length,
      userCount: targetUserIds.length,
    });

    return {
      dispatched: false,
      reason: "NO_ACTIVE_DEVICES",
    };
  }

  const batches = chunkArray(messages, EXPO_BATCH_LIMIT);

  let successCount = 0;
  let failedCount = 0;
  let retryCount = 0;
  const invalidTokens = new Set();

  for (const batch of batches) {
    try {
      const { tickets, attemptsUsed } = await sendExpoBatchWithRetry(batch);
      retryCount += Math.max(attemptsUsed - 1, 0);

      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index] || {};
        const meta = batch[index];

        if (ticket.status === "ok") {
          successCount += 1;
          continue;
        }

        failedCount += 1;
        const errorCode =
          ticket.details && ticket.details.error
            ? ticket.details.error
            : ticket.message;

        if (isInvalidTokenError(errorCode)) {
          invalidTokens.add(meta.pushToken);
        }
      }
    } catch (error) {
      failedCount += batch.length;
      retryCount += EXPO_MAX_RETRIES;

      logger.error("Expo push batch permanently failed", {
        errorMessage: error.message,
        batchSize: batch.length,
      });
    }
  }

  let invalidatedTokenCount = 0;
  if (invalidTokens.size > 0) {
    const invalidationResult = await deviceService.invalidatePushTokens(
      Array.from(invalidTokens),
    );
    invalidatedTokenCount = Number(invalidationResult.modifiedCount || 0);
  }

  logger.info("Expo push dispatch completed", {
    eventName:
      eventPayload && eventPayload.sourceEvent
        ? eventPayload.sourceEvent
        : "order.status.changed",
    notificationCount: notifications.length,
    targetedUsers: targetUserIds.length,
    targetedDevices: messages.length,
    batchCount: batches.length,
    successCount,
    failedCount,
    retryCount,
    invalidTokenCount: invalidTokens.size,
    invalidatedTokenCount,
  });

  return {
    dispatched: true,
    targetedDevices: messages.length,
    successCount,
    failedCount,
    retryCount,
    invalidTokenCount: invalidTokens.size,
    invalidatedTokenCount,
  };
}

module.exports = {
  dispatchExpoPushNotifications,
  isExpoPushToken,
  buildExpoMessages,
  chunkArray,
};
