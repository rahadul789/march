const os = require('os');
const { getDatabaseHealth } = require('../database/mongoose');
const { getMetricsSnapshot } = require('../monitoring/metrics');

function getHealthSnapshot() {
  const database = getDatabaseHealth();
  const metrics = getMetricsSnapshot();
  const healthy = database.state === 'connected';

  return {
    status: healthy ? 'ok' : 'degraded',
    environment: process.env.NODE_ENV || 'development',
    service: 'march-food-delivery-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    host: {
      hostname: os.hostname(),
      platform: process.platform,
      nodeVersion: process.version
    },
    services: {
      database
    },
    metrics
  };
}

module.exports = {
  getHealthSnapshot
};
