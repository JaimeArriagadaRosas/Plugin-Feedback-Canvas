import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { boot } from './boot/logger.js';
import { clearPorts } from './portManager.js';
import { ask, showMainMenu, showApiTokenMenu } from './cli.js';
import { runBlackBoxTests } from './testRunner.js';
import { writeEnvOverrides, updateEnvVars, getEnvVar } from './envWriter.js';
import { spawnVite, spawnBackend, waitForBackend, stopBackend, VITE_PORT, SERVER_PORT } from './process.js';
import { openBrowser } from './browser.js';
import { StaticChecker } from './boot/checks/StaticChecker.js';
import { LocalDevOrchestrator } from '../setup/local-dev/LocalDevOrchestrator.js';
import { LtiBootstrap } from './boot/lti.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(__dirname, '..', '..', '..', '..');
const CANVAS_DIR = path.resolve(__dirname, '..', '..', '..', '..', '..', 'canvas-lms-master');

const CANVAS_ADMIN_EMAIL = process.env.CANVAS_ADMIN_EMAIL || 'admin@canvas.local';
const CANVAS_ADMIN_PASS = process.env.CANVAS_ADMIN_PASS || 'password123';
const CANVAS_TEACHER_EMAIL = process.env.CANVAS_TEACHER_PASS ? process.env.CANVAS_TEACHER_EMAIL || 'profesor@canvas.local' : 'profesor@canvas.local';
const CANVAS_TEACHER_PASS = process.env.CANVAS_TEACHER_PASS || 'password123';
const CANVAS_STUDENT_PASS = process.env.CANVAS_STUDENT_PASS || 'password123';

if (!process.env.CANVAS_ADMIN_PASS) {
  boot.info('Usando contraseñas por defecto para cuentas de prueba locales.');
}

function printCanvasCredentials() {
  boot.withStage('Credenciales de Canvas LMS', () => {
    boot.info(`[Administrador] ${CANVAS_ADMIN_EMAIL} / ${CANVAS_ADMIN_PASS}`);
    boot.info(`[Profesor]     ${CANVAS_TEACHER_EMAIL} / ${CANVAS_TEACHER_PASS}`);
    boot.info(`[Estudiantes]  estudiante1@canvas.local … estudiante5@canvas.local / ${CANVAS_STUDENT_PASS}`);
  });
}

async function handleSpecialModes(mode) {
  if (mode === '5') {
    await boot.withStage('Validaciones de caja negra', async () => runBlackBoxTests(PLUGIN_DIR));
    await ask('\nPresione Enter para salir...');
    process.exit(0);
  }

  if (mode === '2') {
    const { runDeploymentSetup } = await import('../../../../scripts/deploy/index.mjs');
    await runDeploymentSetup();
    process.exit(0);
  }
}

async function prepareEnvironment(mode, checker) {
  await checker.runAll(mode);
  process.env.STARTUP_MODE = mode;
  process.env.NON_INTERACTIVE = 'true';
  writeEnvOverrides(PLUGIN_DIR, mode, false);
}

async function configureMode(mode, localOrchestrator, checker) {
  if (mode === '3') {
    await localOrchestrator.setupLocalCanvas(mode);
    printCanvasCredentials();
  } else {
    if (mode === '4') {
      const defaultUrl = getEnvVar(PLUGIN_DIR, 'CANVAS_BASE_URL');
      const defaultToken = getEnvVar(PLUGIN_DIR, 'CANVAS_ACCESS_TOKEN');
      const defaultCourseId = getEnvVar(PLUGIN_DIR, 'CANVAS_COURSE_ID');
      const { baseUrl, token, courseId } = await showApiTokenMenu(defaultUrl, defaultToken, defaultCourseId);
      updateEnvVars(PLUGIN_DIR, {
        CANVAS_BASE_URL: baseUrl,
        CANVAS_ACCESS_TOKEN: token,
        CANVAS_COURSE_ID: courseId,
      });
      boot.success('Credenciales API guardadas en .env.');
      boot.info('Abriendo frontend del plugin (modo API)...');
      await openBrowser(`https://localhost:5173/?course_id=${courseId || '1'}`);
    } else {
      boot.info('Esperando lanzamiento LTI 1.3 desde Canvas.');
      boot.info('OIDC: https://localhost:8080/api/lti/authorize_redirect · Callback: https://localhost:3000/api/lti/callback');
      boot.info('El navegador no se abrirá automáticamente.');
    }

    await checker.runCheck('Verificación LTI (no local)', async () => {
      const lti = new LtiBootstrap({ mode, log: boot });
      return lti.run();
    });
  }
}

async function startServices(mode, localOrchestrator) {
  let backend;
  await boot.withStage('Arranque del backend', async () => {
    boot.info('Iniciando servidor backend...');
    try {
      backend = spawnBackend();
      await waitForBackend(backend);
      boot.success('Backend escuchando en :3000.');
      
      if (mode === '3') {
        await localOrchestrator.startTlsProxy();
      }
    } catch (err) {
      boot.error(`No se pudo iniciar el backend: ${err.message}`);
      await ask('Presione Enter para salir...');
      process.exit(1);
    }

    if (mode !== '1') {
      const viteSpinner = (await import('nanospinner')).createSpinner('Iniciando frontend (Vite)...');
      viteSpinner.start();
      spawnVite();
      viteSpinner.success({ text: 'Frontend iniciado localmente' });
    } else {
      boot.info('Modo de Producción: Sirviendo frontend desde /dist (Requiere ejecución previa de npm run build)');
    }
  });
  return backend;
}

function setupGracefulShutdown(backend, localOrchestrator) {
  const shutdown = async () => {
    boot.info('Deteniendo (Graceful Shutdown)...');
    if (localOrchestrator) await localOrchestrator.stopTlsProxy();
    if (backend) {
      try { await stopBackend(backend); } catch { /* ignore */ }
    }
    try {
      await clearPorts(VITE_PORT, SERVER_PORT);
    } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return shutdown;
}

export async function main() {
  let backend = null;
  let localOrchestrator = null;
  let shutdownHandler = null;

  try {
    await boot.withStage('Preparación de puertos', async () => {
      await clearPorts(VITE_PORT, SERVER_PORT);
      boot.success('Puertos liberados.');
    });

    const mode = await showMainMenu();
    await handleSpecialModes(mode);

    const checker = new StaticChecker(PLUGIN_DIR);
    await prepareEnvironment(mode, checker);

    localOrchestrator = new LocalDevOrchestrator(boot, PLUGIN_DIR, CANVAS_DIR);
    await configureMode(mode, localOrchestrator, checker);

    backend = await startServices(mode, localOrchestrator);
    shutdownHandler = setupGracefulShutdown(backend, localOrchestrator);

    if (mode === '3') {
      await localOrchestrator.waitForCanvasAndOpenBrowser();
    }

    boot.success('Arranque completado. El plugin Feedback está operativo.');
    boot.info('Mantenga esta consola abierta. Presione Ctrl+C para detener.');

  } catch (e) {
    boot.error(`Error crítico: ${e.message}`);
    if (e.stack) boot.debug(e.stack);
    
    boot.info('Ejecutando limpieza por error (Graceful Shutdown)...');
    if (shutdownHandler) {
      await shutdownHandler();
    } else {
      try {
        const { stopTlsProxy } = await import('./tlsProxy.js');
        stopTlsProxy();
      } catch { /* ignore */ }
      try {
        await clearPorts(VITE_PORT, SERVER_PORT);
      } catch { /* ignore */ }
      process.exit(1);
    }
  }
}
