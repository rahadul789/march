const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: true
  },
  handler(req, res) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.'
      },
      requestId: res.locals.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = limiter;
