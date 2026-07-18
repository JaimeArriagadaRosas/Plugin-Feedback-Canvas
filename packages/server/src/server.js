import { createApp } from './services/server/middleware.js';
import { startServer } from './services/server/bootstrap.js';

const { app, PORT } = createApp();

const isNonInteractive = process.env.NON_INTERACTIVE === 'true';
const mode = process.env.STARTUP_MODE || '3';
process.env.STARTUP_MODE = mode;

if (isNonInteractive && mode === '3') {
  const { notifyCanvasReady, notifyCanvasError } = await import('./orchestration/browser.js');
  import('./services/infrastructure/CanvasConfigurator.js').then(({ default: CanvasConfigurator }) => {
    CanvasConfigurator.copyDefaultConfigs();
    console.info('[Inicio] Gestionando contenedores de Canvas local en Docker...');
    global.isCanvasInitializing = true;
    startServer(app, PORT);
    import('./services/infrastructure/CanvasManager_local.js').then(({ default: CanvasLocalManager }) => {
      CanvasLocalManager.autoStartAndInitialize()
        .then(() => {
          global.isCanvasInitializing = false;
          notifyCanvasReady();
          console.info('[Inicio] Canvas local listo y proxy habilitado.');
        })
        .catch((error) => {
          global.isCanvasInitializing = false;
          notifyCanvasError(error);
          console.error('[Inicio] Error critico al iniciar Canvas local:', { error: error.message });
        });
    });
  });
} else {
  console.info('[Inicio] Entorno configurado. Esperando conexiones de autenticacion...');
  startServer(app, PORT);
}

export default app;
