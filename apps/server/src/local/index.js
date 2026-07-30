import { createApp } from '../services/server/middleware.js';
import { startServer } from '../services/server/bootstrap.js';
import { configureLocalTLS } from './TLSConfigurator.js';
import { notifyCanvasReady, notifyCanvasError, openBrowser } from './browser.js';
import CanvasConfigurator from './CanvasConfigurator.js';
import CanvasLocalManager from './CanvasManager.js';
import logger from '../utils/logger.js';
import { shutdown } from '../server.js';

export async function startLocalOrchestrator() {
  configureLocalTLS();
  
  const { app, PORT } = createApp();
  
  app.use('/api', (req, res, next) => {
    if (global.canvasState === 'ERROR') {
      return res.status(503).json({ error: 'Canvas LMS inicialización fallida. Entorno degradado.' });
    }
    next();
  });
  
  CanvasConfigurator.copyDefaultConfigs();
  logger.info('[CANVAS] Gestionando contenedores de Canvas local en Docker...');
  global.canvasState = 'INITIALIZING';
  global.isCanvasInitializing = true;
  
  try {
    const serverInstance = await startServer(app, PORT);
    
    await CanvasLocalManager.autoStartAndInitialize();
    
    global.isCanvasInitializing = false;
    global.canvasState = 'READY';
    notifyCanvasReady();
    
    openBrowser('https://localhost:8443');
  } catch (error) {
    global.isCanvasInitializing = false;
    global.canvasState = 'ERROR';
    notifyCanvasError(error);
    logger.error('[CANVAS] Error crítico al iniciar Canvas local:', { error: error.message });
    shutdown('SIGINT');
  }
}
