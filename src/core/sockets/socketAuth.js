const logger = require('../logger/logger');
const { verifyAccessToken } = require('../../modules/auth/service/token.service');
const { User } = require('../../modules/auth/model');
const { ACCOUNT_STATUSES } = require('../../modules/auth/types');

function extractSocketAccessToken(socket) {
  const handshake = socket && socket.handshake ? socket.handshake : {};
  const auth = handshake.auth && typeof handshake.auth === 'object' ? handshake.auth : {};

  if (typeof auth.token === 'string' && auth.token.trim()) {
    return auth.token.trim();
  }

  const authorization = handshake.headers && handshake.headers.authorization;
  if (typeof authorization === 'string') {
    const [scheme, token] = authorization.split(' ');
    if (scheme === 'Bearer' && token) {
      return token;
    }
  }

  throw new Error('SOCKET_AUTH_TOKEN_MISSING');
}

async function authenticateSocketConnection(socket, next) {
  try {
    const accessToken = extractSocketAccessToken(socket);
    const decoded = verifyAccessToken(accessToken);

    const user = await User.findById(decoded.sub).select('role status');

    if (!user) {
      throw new Error('SOCKET_AUTH_USER_NOT_FOUND');
    }

    if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
      throw new Error('SOCKET_AUTH_ACCOUNT_SUSPENDED');
    }

    socket.data.auth = {
      userId: user._id.toString(),
      role: user.role,
      status: user.status,
      sessionId: decoded.sid || null
    };

    next();
  } catch (error) {
    logger.warn('Socket authentication failed', {
      socketId: socket && socket.id ? socket.id : null,
      reason: error.message
    });

    const authError = new Error('SOCKET_AUTH_FAILED');
    authError.data = {
      reason: error.message
    };
    next(authError);
  }
}

module.exports = {
  extractSocketAccessToken,
  authenticateSocketConnection
};
