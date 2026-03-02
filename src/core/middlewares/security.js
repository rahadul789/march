const helmet = require('helmet');
const cors = require('cors');
const env = require('../config/env');
const AppError = require('../errors/AppError');

function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  if (env.CORS_ORIGINS.includes('*')) {
    return true;
  }

  return env.CORS_ORIGINS.includes(origin);
}

function applySecurityMiddlewares(app) {
  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new AppError('CORS policy violation', 403, 'CORS_FORBIDDEN'));
      },
      credentials: true,
      optionsSuccessStatus: 204
    })
  );
}

module.exports = applySecurityMiddlewares;
