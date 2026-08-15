import { createApp } from './services/server/middleware.js';
import { startServer } from './services/server/appFactory.js'; // Updated to use the new appFactory
import db from './data/db.js';
import logger from './utils/logger.js';

const { app, PORT } = createApp();

let serverInstance = null;

export async function shutdown(signal = 'SIGINT', errorDetails = null) {
  const isOrchestrated = !!process.env.STARTUP_MODE;

  if (!isOrchestrated) {
    logger.info(`[SHUTDOWN] Received signal ${signal}. Closing server gracefully...`);
  }

  if (serverInstance) {
    if (serverInstance.tokenRotationJob) {
      serverInstance.tokenRotationJob.stop();
    }
    serverInstance.close(() => {
      if (!isOrchestrated) logger.info('[SHUTDOWN] HTTP server closed (not accepting new connections).');
    });
  }
  if (db.pool) {
    try {
      await db.pool.end();
      if (!isOrchestrated) logger.info('[SHUTDOWN] PostgreSQL pool closed.');
    } catch (e) {
      if (!isOrchestrated) logger.warn('[SHUTDOWN] Error closing PostgreSQL pool:', { error: e.message });
    }
  }
  
  const isError = signal === 'STARTUP_ERROR' || signal === 'uncaughtException' || signal === 'unhandledRejection';
  const exitCode = isError ? 1 : 0;
  
  if (isError && process.send) {
    process.send({ type: 'server-error', message: errorDetails || `Initialization error (${signal})` });
  }

  if (!isOrchestrated) logger.info(`[SHUTDOWN] Process terminating with code ${exitCode}.`);
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error('[SERVER] Uncaught exception (uncaughtException):', err);
  shutdown('uncaughtException', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[SERVER] Unhandled promise rejection (unhandledRejection):', { reason, promise });
  shutdown('unhandledRejection', reason?.message || String(reason));
});

logger.info('[SERVER] Environment configured. Waiting for authentication connections...');
startServer(app, PORT).then((server) => {
  serverInstance = server;
}).catch((err) => {
  logger.error('[SERVER] Could not start backend:', err);
  shutdown('STARTUP_ERROR', err.message);
});

export default app;
