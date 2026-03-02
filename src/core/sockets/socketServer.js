const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../logger/logger');

let ioInstance = null;

function initializeSocketServer(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS,
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  ioInstance.on('connection', (socket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      activeConnections: ioInstance.engine.clientsCount
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', {
        socketId: socket.id,
        reason,
        activeConnections: ioInstance.engine.clientsCount
      });
    });
  });

  return ioInstance;
}

function getSocketServer() {
  if (!ioInstance) {
    throw new Error('Socket server is not initialized');
  }

  return ioInstance;
}

async function closeSocketServer() {
  if (!ioInstance) {
    return;
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
  closeSocketServer
};
