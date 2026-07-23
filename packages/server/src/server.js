import { createApp } from './services/server/middleware.js';
import { startServer } from './services/server/bootstrap.js';
import db from './data/db.js';

const { app, PORT } = createApp();

app.use('/api', (req, res, next) => {
  if (global.canvasState === 'ERROR') {
    return res.status(503).json({ error: 'Canvas LMS inicialización fallida. Entorno degradado.' });
  }
  next();
});

const isNonInteractive = process.env.NON_INTERACTIVE === 'true';
const mode = process.env.STARTUP_MODE || (process.env.NODE_ENV === 'production' ? '1' : '3');
process.env.STARTUP_MODE = mode;

import { configureLocalTLS } from './orchestration/TLSConfigurator_local.js';
import logger from './utils/logger.js';

configureLocalTLS();

let serverInstance = null;

async function shutdown(signal) {
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

if (isNonInteractive && mode === '3') {
  const { notifyCanvasReady, notifyCanvasError } = await import('./orchestration/browser.js');
  import('./services/infrastructure/CanvasConfigurator.js').then(({ default: CanvasConfigurator }) => {
    CanvasConfigurator.copyDefaultConfigs();
    logger.info('[CANVAS] Gestionando contenedores de Canvas local en Docker...');
    global.canvasState = 'INITIALIZING';
    global.isCanvasInitializing = true;
    startServer(app, PORT).then((server) => {
      serverInstance = server;
      import('./services/infrastructure/CanvasManager_local.js').then(({ default: CanvasLocalManager }) => {
        CanvasLocalManager.autoStartAndInitialize()
          .then(() => {
            global.isCanvasInitializing = false;
            global.canvasState = 'READY';
            notifyCanvasReady();
          })
          .catch((error) => {
            global.isCanvasInitializing = false;
            global.canvasState = 'ERROR';
            notifyCanvasError(error);
            logger.error('[CANVAS] Error crítico al iniciar Canvas local:', { error: error.message });
            process.kill(process.pid, 'SIGINT'); 
          });
      });
    }).catch((err) => {
      logger.error('[SERVER] No se pudo iniciar el backend:', err);
      process.kill(process.pid, 'SIGINT');
    });
  });
} else {
  logger.info('[SERVER] Entorno configurado. Esperando conexiones de autenticación...');
  startServer(app, PORT).then((server) => {
    serverInstance = server;
  }).catch((err) => {
    logger.error('[SERVER] No se pudo iniciar el backend:', err);
    process.kill(process.pid, 'SIGINT');
  });
}

export default app;
