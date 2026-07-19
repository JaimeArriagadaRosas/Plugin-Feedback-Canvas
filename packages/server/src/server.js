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
const mode = process.env.STARTUP_MODE || '3';
process.env.STARTUP_MODE = mode;

import { configureLocalTLS } from './orchestration/TLSConfigurator_local.js';
import logger from './utils/logger.js';

configureLocalTLS();

let serverInstance = null;

async function shutdown(signal) {
  logger.info(`[SHUTDOWN] Recibida señal ${signal}. Cerrando servidor gracefully...`);
  if (serverInstance) {
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
    logger.info('[Inicio] Gestionando contenedores de Canvas local en Docker...');
    global.canvasState = 'INITIALIZING';
    startServer(app, PORT).then((server) => {
      serverInstance = server;
      import('./services/infrastructure/CanvasManager_local.js').then(({ default: CanvasLocalManager }) => {
        CanvasLocalManager.autoStartAndInitialize()
          .then(() => {
            global.isCanvasInitializing = false;
            global.canvasState = 'READY';
            notifyCanvasReady();
            logger.info('[Inicio] Canvas local listo y proxy habilitado.');
          })
          .catch((error) => {
            global.isCanvasInitializing = false;
            global.canvasState = 'ERROR';
            notifyCanvasError(error);
            logger.error('[Inicio] Error critico al iniciar Canvas local:', { error: error.message });
            process.kill(process.pid, 'SIGINT'); 
          });
      });
    }).catch((err) => {
      logger.error('[Inicio] No se pudo iniciar el backend:', err);
      process.kill(process.pid, 'SIGINT');
    });
  });
} else {
  logger.info('[Inicio] Entorno configurado. Esperando conexiones de autenticacion...');
  startServer(app, PORT).then((server) => {
    serverInstance = server;
  }).catch((err) => {
    logger.error('[Inicio] No se pudo iniciar el backend:', err);
    process.kill(process.pid, 'SIGINT');
  });
}

export default app;
