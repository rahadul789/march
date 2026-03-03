const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { Device } = require('../model');
const { DEVICE_TYPES } = require('../types');

function normalizeDeviceType(rawType) {
  if (!rawType || typeof rawType !== 'string') {
    return DEVICE_TYPES.UNKNOWN;
  }

  const normalized = rawType.trim().toLowerCase();

  if (Object.values(DEVICE_TYPES).includes(normalized)) {
    return normalized;
  }

  if (normalized === 'iphone' || normalized === 'ipad') {
    return DEVICE_TYPES.IOS;
  }

  return DEVICE_TYPES.UNKNOWN;
}

function toObjectId(value, fieldName) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`${fieldName} must be a valid ObjectId`, 400, 'VALIDATION_ERROR', {
      field: fieldName
    });
  }

  return new mongoose.Types.ObjectId(value);
}

function sanitizeDevice(device) {
  return {
    id: device._id.toString(),
    userId: device.userId.toString(),
    sessionId: device.sessionId.toString(),
    deviceId: device.deviceId,
    pushToken: device.pushToken,
    deviceType: device.deviceType,
    lastActive: device.lastActive,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  };
}

async function upsertDeviceForSession(payload) {
  const userId = toObjectId(payload.userId, 'userId');
  const sessionId = toObjectId(payload.sessionId, 'sessionId');

  const normalizedPushToken =
    typeof payload.pushToken === 'string' && payload.pushToken.trim()
      ? payload.pushToken.trim()
      : null;

  const normalizedDeviceId =
    typeof payload.deviceId === 'string' && payload.deviceId.trim()
      ? payload.deviceId.trim()
      : null;

  const normalizedDeviceType = normalizeDeviceType(payload.deviceType || payload.platform);

  const now = new Date();

  const updated = await Device.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        userId,
        sessionId,
        deviceId: normalizedDeviceId,
        pushToken: normalizedPushToken,
        deviceType: normalizedDeviceType,
        lastActive: now,
        userAgent: payload.userAgent || null,
        ipAddress: payload.ipAddress || null
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  if (normalizedPushToken) {
    await Device.updateMany(
      {
        pushToken: normalizedPushToken,
        sessionId: { $ne: sessionId }
      },
      {
        $set: {
          pushToken: null,
          lastActive: now
        }
      }
    );
  }

  return sanitizeDevice(updated);
}

async function removeDeviceBySession(payload) {
  if (!payload || !payload.sessionId) {
    return { removed: false };
  }

  const sessionId = toObjectId(payload.sessionId, 'sessionId');
  const query = { sessionId };

  if (payload.userId) {
    query.userId = toObjectId(payload.userId, 'userId');
  }

  const result = await Device.deleteOne(query);

  return {
    removed: result.deletedCount > 0
  };
}

async function markDeviceActiveBySession(payload) {
  const sessionId = toObjectId(payload.sessionId, 'sessionId');

  await Device.updateOne(
    { sessionId },
    {
      $set: {
        lastActive: new Date()
      }
    }
  );
}

async function getUserDevices(userId) {
  const objectId = toObjectId(userId, 'userId');

  const devices = await Device.find({ userId: objectId })
    .sort({ lastActive: -1 })
    .lean();

  return devices.map((device) => ({
    id: device._id.toString(),
    userId: device.userId.toString(),
    sessionId: device.sessionId.toString(),
    deviceId: device.deviceId,
    pushToken: device.pushToken,
    deviceType: device.deviceType,
    lastActive: device.lastActive,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  }));
}

module.exports = {
  upsertDeviceForSession,
  removeDeviceBySession,
  markDeviceActiveBySession,
  getUserDevices,
  normalizeDeviceType
};
