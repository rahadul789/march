const env = require('../config/env');

const severityOrder = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const activeSeverity = severityOrder[env.LOG_LEVEL] ?? severityOrder.info;

function shouldLog(level) {
  return severityOrder[level] <= activeSeverity;
}

function write(level, message, meta = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.info(line);
}

module.exports = {
  info(message, meta) {
    write('info', message, meta);
  },
  warn(message, meta) {
    write('warn', message, meta);
  },
  error(message, meta) {
    write('error', message, meta);
  }
};
