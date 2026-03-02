const logger = require('../logger/logger');

const requestStats = {
  totalRequests: 0,
  totalErrors: 0,
  activeRequests: 0,
  startedAt: new Date().toISOString()
};

function requestMetricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  requestStats.totalRequests += 1;
  requestStats.activeRequests += 1;

  res.on('finish', () => {
    requestStats.activeRequests -= 1;

    if (res.statusCode >= 500) {
      requestStats.totalErrors += 1;
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    logger.info('HTTP request completed', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    });
  });

  next();
}

function getMetricsSnapshot() {
  return {
    ...requestStats,
    uptimeSeconds: Math.floor(process.uptime())
  };
}

module.exports = {
  requestMetricsMiddleware,
  getMetricsSnapshot
};
