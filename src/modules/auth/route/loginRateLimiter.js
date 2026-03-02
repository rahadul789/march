const rateLimit = require("express-rate-limit");
const env = require("../../../core/config/env");

const loginRateLimiter = rateLimit({
  windowMs: env.AUTH_LOGIN_WINDOW_MS,
  max: env.AUTH_LOGIN_MAX_ATTEMPTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator(req) {
    const identifier =
      req.body && typeof req.body.identifier === "string"
        ? req.body.identifier.trim().toLowerCase()
        : "unknown";

    return `${req.ip}:${identifier}`;
  },
  handler(req, res) {
    res.status(429).json({
      success: false,
      error: {
        code: "LOGIN_RATE_LIMIT_EXCEEDED",
        message: "Too many login attempts. Please try again later.",
      },
      requestId: res.locals.requestId,
      timestamp: new Date().toISOString(),
    });
  },
});

module.exports = loginRateLimiter;
