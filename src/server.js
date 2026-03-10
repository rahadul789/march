const http = require("http");

const env = require("./core/config/env");
const app = require("./app");
const logger = require("./core/logger/logger");
const {
  connectWithRetry,
  disconnectDatabase,
} = require("./core/database/mongoose");
const {
  initializeSocketServer,
  createSocketNotificationBroadcaster,
  closeSocketServer,
} = require("./core/sockets/socketServer");
const {
  initializeNotificationService,
} = require("./modules/notification/service");

let httpServer;
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.warn("Graceful shutdown initiated", { signal });

  const forceCloseTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timeout reached, forcing exit");
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);

  forceCloseTimeout.unref();

  try {
    await closeSocketServer();

    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    await disconnectDatabase();

    logger.info("Graceful shutdown completed");
    clearTimeout(forceCloseTimeout);
    process.exit(0);
  } catch (error) {
    logger.error("Graceful shutdown failed", {
      message: error.message,
      stack: error.stack,
    });
    clearTimeout(forceCloseTimeout);
    process.exit(1);
  }
}

async function startServer() {
  await connectWithRetry();

  httpServer = http.createServer(app);
  const io = initializeSocketServer(httpServer);

  initializeNotificationService({
    onSocketBroadcast: createSocketNotificationBroadcaster(io),
  });

  httpServer.listen(env.PORT, () => {
    logger.info("HTTP server started", {
      port: env.PORT,
      env: env.NODE_ENV,
      apiPrefix: env.API_PREFIX,
    });
  });
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  gracefulShutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    message: error.message,
    stack: error.stack,
  });
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

startServer().catch((error) => {
  logger.error("Server startup failed", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
