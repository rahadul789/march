const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../logger/logger');
const { authenticateSocketConnection } = require('./socketAuth');
const { registerSocketArchitecture } = require('./socketEvents');
const { getUserRoom } = require('./socketRooms');

let ioInstance = null;
let cleanupSocketArchitecture = null;

function initializeSocketServer(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS,
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
    connectionStateRecovery: {
      maxDisconnectionDuration: env.SOCKET_CONNECTION_STATE_RECOVERY_MS || 2 * 60 * 1000,
      skipMiddlewares: false
    }
  });

  ioInstance.use(authenticateSocketConnection);
  cleanupSocketArchitecture = registerSocketArchitecture(ioInstance);

  return ioInstance;
}

function getSocketServer() {
  if (!ioInstance) {
    throw new Error('Socket server is not initialized');
  }

  return ioInstance;
}

function createSocketNotificationBroadcaster(ioOverride) {
  const io = ioOverride || getSocketServer();

  return async function socketNotificationBroadcaster(notifications) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return;
    }

    for (const notification of notifications) {
      if (!notification || !notification.userId) {
        continue;
      }

      io.to(getUserRoom(notification.userId)).emit('notification:new', notification);
    }

    logger.info('Socket notification broadcast completed', {
      notificationCount: notifications.length
    });
  };
}

async function closeSocketServer() {
  if (!ioInstance) {
    return;
  }

  if (typeof cleanupSocketArchitecture === 'function') {
    cleanupSocketArchitecture();
    cleanupSocketArchitecture = null;
  }

  await new Promise((resolve) => {
    ioInstance.close(() => {
      resolve();
    });
  });

  ioInstance = null;
}

module.exports = {
  initializeSocketServer,
  getSocketServer,
  createSocketNotificationBroadcaster,
  closeSocketServer
};
