const { randomUUID, createHash } = require('crypto');
const jwt = require('jsonwebtoken');
const AppError = require('../../../core/errors/AppError');
const env = require('../../../core/config/env');
const { TOKEN_TYPES } = require('../types');

function hashTokenId(tokenId) {
  return createHash('sha256').update(tokenId).digest('hex');
}

function buildJwtOptions(expiresIn) {
  return {
    expiresIn,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  };
}

function signAccessToken({ userId, role, status, sessionId }) {
  return jwt.sign(
    {
      sub: String(userId),
      role,
      status,
      sid: String(sessionId),
      type: TOKEN_TYPES.ACCESS
    },
    env.ACCESS_TOKEN_SECRET,
    buildJwtOptions(env.ACCESS_TOKEN_EXPIRES_IN)
  );
}

function signRefreshToken({ userId, sessionId, tokenId }) {
  return jwt.sign(
    {
      sub: String(userId),
      sid: String(sessionId),
      jti: tokenId,
      type: TOKEN_TYPES.REFRESH
    },
    env.REFRESH_TOKEN_SECRET,
    buildJwtOptions(env.REFRESH_TOKEN_EXPIRES_IN)
  );
}

function decodeTokenExpiryDate(token) {
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded.exp !== 'number') {
    throw new AppError('Failed to decode token expiry', 500, 'TOKEN_DECODE_FAILED');
  }

  return new Date(decoded.exp * 1000);
}

function createRefreshTokenDescriptor({ userId, sessionId }) {
  const tokenId = randomUUID();
  const refreshToken = signRefreshToken({ userId, sessionId, tokenId });

  return {
    refreshToken,
    tokenId,
    tokenIdHash: hashTokenId(tokenId),
    expiresAt: decodeTokenExpiryDate(refreshToken)
  };
}

function verifyAccessToken(accessToken) {
  const decoded = jwt.verify(accessToken, env.ACCESS_TOKEN_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  });

  if (decoded.type !== TOKEN_TYPES.ACCESS) {
    throw new AppError('Invalid access token type', 401, 'INVALID_ACCESS_TOKEN');
  }

  return decoded;
}

function verifyRefreshToken(refreshToken, options = {}) {
  const decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    ignoreExpiration: Boolean(options.ignoreExpiration)
  });

  if (decoded.type !== TOKEN_TYPES.REFRESH) {
    throw new AppError('Invalid refresh token type', 401, 'INVALID_REFRESH_TOKEN');
  }

  return decoded;
}

module.exports = {
  hashTokenId,
  signAccessToken,
  createRefreshTokenDescriptor,
  verifyAccessToken,
  verifyRefreshToken
};
