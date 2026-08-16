import { createApp } from '../services/server/middleware.js';
import { startServer } from '../services/server/appFactory.js';
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
      return res.status(503).json({ error: 'Canvas LMS initialization failed. Degraded environment.' });
    }
    next();
  });
  
  CanvasConfigurator.copyDefaultConfigs();
  logger.info('[CANVAS] Managing local Canvas containers in Docker...');
  global.canvasState = 'INITIALIZING';
  global.isCanvasInitializing = true;
  
  try {
    const _serverInstance = await startServer(app, PORT);
    
    await CanvasLocalManager.autoStartAndInitialize();
    
    global.isCanvasInitializing = false;
    global.canvasState = 'READY';
    notifyCanvasReady();
    
    openBrowser('https://localhost:8443');
  } catch (error) {
    global.isCanvasInitializing = false;
    global.canvasState = 'ERROR';
    notifyCanvasError(error);
    logger.error('[CANVAS] Critical error starting local Canvas:', { error: error.message });
    shutdown('SIGINT');
  }
}
