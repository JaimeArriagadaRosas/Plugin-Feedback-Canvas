import { createApp } from './services/server/middleware.js';
import { startServer } from './services/server/bootstrap.js';
import db from './data/db.js';
import logger from './utils/logger.js';

const { app, PORT } = createApp();

let serverInstance = null;

export async function shutdown(signal = 'SIGINT') {
  logger.info(`[SHUTDOWN] Recibida señal ${signal}. Cerrando servidor gracefully...`);
  if (serverInstance) {
    if (serverInstance.tokenRotationJob) {
      serverInstance.tokenRotationJob.stop();
    }
    serverInstance.close(() => {
      logger.info('[SHUTDOWN] Servidor HTTP cerrado (no acepta nuevas conexiones).');
    });
  }
  if (db.pool) {
    try {
      await db.pool.end();
      logger.info('[SHUTDOWN] Pool de PostgreSQL cerrado.');
    } catch (e) {
      logger.warn('[SHUTDOWN] Error cerrando pool de PostgreSQL:', { error: e.message });
    }
  }
  logger.info('[SHUTDOWN] Proceso terminando.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error('[SERVER] Excepción no capturada (uncaughtException):', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[SERVER] Promesa rechazada no manejada (unhandledRejection):', { reason, promise });
  shutdown('unhandledRejection');
});

logger.info('[SERVER] Entorno configurado. Esperando conexiones de autenticación...');
startServer(app, PORT).then((server) => {
  serverInstance = server;
}).catch((err) => {
  logger.error('[SERVER] No se pudo iniciar el backend:', err);
  shutdown('STARTUP_ERROR');
});

export default app;
