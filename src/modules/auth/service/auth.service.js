const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const logger = require('../../../core/logger/logger');
const { User, RefreshSession } = require('../model');
const { ACCOUNT_STATUSES, SESSION_STATUSES } = require('../types');
const { hashPassword, verifyPassword } = require('./password.service');
const {
  hashTokenId,
  signAccessToken,
  createRefreshTokenDescriptor,
  verifyRefreshToken
} = require('./token.service');

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function normalizeIdentifier(identifier) {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
}

function buildAuthQueryFromIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier);

  if (normalized.includes('@')) {
    return { email: normalized };
  }

  return { phone: normalized };
}

function buildDeviceInfo(context = {}) {
  return {
    deviceId: context.deviceId || null,
    platform: context.platform || null,
    userAgent: context.userAgent || null,
    ipAddress: context.ipAddress || null,
    pushToken: context.pushToken || null
  };
}

async function register(payload) {
  const existingUser = await User.findOne({
    $or: [{ email: payload.email }, { phone: payload.phone }]
  }).lean();

  if (existingUser) {
    throw new AppError('Email or phone already in use', 409, 'DUPLICATE_CREDENTIAL');
  }

  const passwordHash = await hashPassword(payload.password);

  const user = await User.create({
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    passwordHash,
    role: payload.role,
    status: ACCOUNT_STATUSES.ACTIVE
  });

  return sanitizeUser(user);
}

async function createSessionAndTokens(user, context = {}) {
  const sessionId = new mongoose.Types.ObjectId();
  const refreshDescriptor = createRefreshTokenDescriptor({
    userId: user._id,
    sessionId
  });

  await RefreshSession.create({
    _id: sessionId,
    userId: user._id,
    tokenIdHash: refreshDescriptor.tokenIdHash,
    expiresAt: refreshDescriptor.expiresAt,
    lastUsedAt: new Date(),
    device: buildDeviceInfo(context)
  });

  const accessToken = signAccessToken({
    userId: user._id,
    role: user.role,
    status: user.status,
    sessionId
  });

  return {
    accessToken,
    refreshToken: refreshDescriptor.refreshToken,
    sessionId: sessionId.toString(),
    refreshTokenExpiresAt: refreshDescriptor.expiresAt
  };
}

async function login(payload, context = {}) {
  const query = buildAuthQueryFromIdentifier(payload.identifier);

  const user = await User.findOne(query).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await verifyPassword(payload.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw new AppError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
  }

  const tokens = await createSessionAndTokens(user, context);

  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: sanitizeUser(user),
    tokens
  };
}

async function revokeSessionForReplay(payload) {
  await RefreshSession.findOneAndUpdate(
    {
      _id: payload.sid,
      userId: payload.sub,
      status: SESSION_STATUSES.ACTIVE
    },
    {
      $set: {
        status: SESSION_STATUSES.REVOKED,
        revokedAt: new Date(),
        revokeReason: 'refresh_token_reuse_detected'
      }
    }
  );
}

async function refreshTokens(refreshToken, context = {}) {
  const payload = verifyRefreshToken(refreshToken);

  if (!payload.sid || !payload.jti || !payload.sub) {
    throw new AppError('Invalid refresh token payload', 401, 'INVALID_REFRESH_TOKEN');
  }

  const oldTokenIdHash = hashTokenId(payload.jti);
  const nextTokenDescriptor = createRefreshTokenDescriptor({
    userId: payload.sub,
    sessionId: payload.sid
  });

  const now = new Date();

  const updatedSession = await RefreshSession.findOneAndUpdate(
    {
      _id: payload.sid,
      userId: payload.sub,
      status: SESSION_STATUSES.ACTIVE,
      tokenIdHash: oldTokenIdHash,
      expiresAt: { $gt: now }
    },
    {
      $set: {
        tokenIdHash: nextTokenDescriptor.tokenIdHash,
        expiresAt: nextTokenDescriptor.expiresAt,
        lastUsedAt: now,
        rotatedAt: now,
        device: buildDeviceInfo(context)
      },
      $inc: {
        tokenVersion: 1
      }
    },
    { new: true }
  );

  if (!updatedSession) {
    await revokeSessionForReplay(payload);
    throw new AppError('Refresh token is invalid or already rotated', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(payload.sub);

  if (!user) {
    await RefreshSession.updateOne(
      { _id: payload.sid, status: SESSION_STATUSES.ACTIVE },
      {
        $set: {
          status: SESSION_STATUSES.REVOKED,
          revokedAt: new Date(),
          revokeReason: 'user_not_found'
        }
      }
    );

    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }

  if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
    await RefreshSession.updateOne(
      { _id: payload.sid, status: SESSION_STATUSES.ACTIVE },
      {
        $set: {
          status: SESSION_STATUSES.REVOKED,
          revokedAt: new Date(),
          revokeReason: 'account_suspended'
        }
      }
    );

    throw new AppError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
  }

  const accessToken = signAccessToken({
    userId: user._id,
    role: user.role,
    status: user.status,
    sessionId: payload.sid
  });

  return {
    user: sanitizeUser(user),
    tokens: {
      accessToken,
      refreshToken: nextTokenDescriptor.refreshToken,
      sessionId: payload.sid,
      refreshTokenExpiresAt: nextTokenDescriptor.expiresAt
    }
  };
}

async function logout(refreshToken) {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken, { ignoreExpiration: true });
  } catch (error) {
    logger.warn('Logout requested with invalid refresh token', {
      message: error.message
    });
    return { invalidated: false };
  }

  const tokenIdHash = hashTokenId(payload.jti || '');

  const result = await RefreshSession.updateOne(
    {
      _id: payload.sid,
      userId: payload.sub,
      status: SESSION_STATUSES.ACTIVE,
      tokenIdHash
    },
    {
      $set: {
        status: SESSION_STATUSES.REVOKED,
        revokedAt: new Date(),
        revokeReason: 'user_logout'
      }
    }
  );

  return {
    invalidated: result.modifiedCount > 0
  };
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return sanitizeUser(user);
}

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  getCurrentUser
};
