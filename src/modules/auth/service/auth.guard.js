const AppError = require('../../../core/errors/AppError');
const { User } = require('../model');
const { ACCOUNT_STATUSES } = require('../types');
const { verifyAccessToken } = require('./token.service');

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    throw new AppError('Missing authorization header', 401, 'AUTHORIZATION_REQUIRED');
  }

  const [scheme, token] = headerValue.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Invalid authorization format', 401, 'INVALID_AUTHORIZATION_HEADER');
  }

  return token;
}

function requireAuth(req, res, next) {
  Promise.resolve()
    .then(async () => {
      const accessToken = extractBearerToken(req.headers.authorization);
      const decoded = verifyAccessToken(accessToken);

      const user = await User.findById(decoded.sub).select('role status');
      if (!user) {
        throw new AppError('User no longer exists', 401, 'USER_NOT_FOUND');
      }

      if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
        throw new AppError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
      }

      req.auth = {
        userId: user._id.toString(),
        role: user.role,
        status: user.status,
        sessionId: decoded.sid || null
      };

      next();
    })
    .catch(next);
}

function requireRoles(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.auth) {
      next(new AppError('Authentication is required', 401, 'AUTHORIZATION_REQUIRED'));
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new AppError('Insufficient role permissions', 403, 'FORBIDDEN_ROLE'));
      return;
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRoles
};
