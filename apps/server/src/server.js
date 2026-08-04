import { createApp } from './services/server/middleware.js';
import { startServer } from './services/server/appFactory.js'; // Updated to use the new appFactory
import db from './data/db.js';
import logger from './utils/logger.js';

const { app, PORT } = createApp();

let serverInstance = null;

export async function shutdown(signal = 'SIGINT', errorDetails = null) {
  const isOrchestrated = !!process.env.STARTUP_MODE;

  if (!isOrchestrated) {
    logger.info(`[SHUTDOWN] Recibida señal ${signal}. Cerrando servidor gracefully...`);
  }

  if (serverInstance) {
    if (serverInstance.tokenRotationJob) {
      serverInstance.tokenRotationJob.stop();
    }
    serverInstance.close(() => {
      if (!isOrchestrated) logger.info('[SHUTDOWN] Servidor HTTP cerrado (no acepta nuevas conexiones).');
    });
  }
  if (db.pool) {
    try {
      await db.pool.end();
      if (!isOrchestrated) logger.info('[SHUTDOWN] Pool de PostgreSQL cerrado.');
    } catch (e) {
      if (!isOrchestrated) logger.warn('[SHUTDOWN] Error cerrando pool de PostgreSQL:', { error: e.message });
    }
  }
  
  const isError = signal === 'STARTUP_ERROR' || signal === 'uncaughtException' || signal === 'unhandledRejection';
  const exitCode = isError ? 1 : 0;
  
  if (isError && process.send) {
    process.send({ type: 'server-error', message: errorDetails || `Error de inicialización (${signal})` });
  }

  if (!isOrchestrated) logger.info(`[SHUTDOWN] Proceso terminando con código ${exitCode}.`);
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error('[SERVER] Excepción no capturada (uncaughtException):', err);
  shutdown('uncaughtException', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[SERVER] Promesa rechazada no manejada (unhandledRejection):', { reason, promise });
  shutdown('unhandledRejection', reason?.message || String(reason));
});

logger.info('[SERVER] Entorno configurado. Esperando conexiones de autenticación...');
startServer(app, PORT).then((server) => {
  serverInstance = server;
}).catch((err) => {
  logger.error('[SERVER] No se pudo iniciar el backend:', err);
  shutdown('STARTUP_ERROR', err.message);
});

export default app;
