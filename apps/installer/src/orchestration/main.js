import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

import { boot } from './boot/logger.js';
import { assertPortsAvailable } from './portManager.js';
import { ask, showMainMenu } from './cli.js';
import { runBlackBoxTests } from './testRunner.js';
import { writeEnvOverrides } from './envWriter.js';
import { spawnVite, spawnBackend, stopBackend, stopVite, waitForBackend, VITE_PORT, SERVER_PORT } from './process.js';
import { StaticChecker } from './boot/checks/StaticChecker.js';
import { LtiBootstrap } from './boot/lti.js';
import { setupGracefulShutdown } from './shutdown_utils.js';
import { getCanvasDirectory, getPluginDirectory, getAssetsMarker } from '../installation/utils/LocalWorkspacePaths.js';

dotenv.config({ quiet: true });

const PLUGIN_DIR = getPluginDirectory();
const CANVAS_DIR = getCanvasDirectory();

const CANVAS_ADMIN_EMAIL = process.env.CANVAS_ADMIN_EMAIL || 'admin@canvas.local';
// semgrep-ignore
// eslint-disable-next-line
const CANVAS_ADMIN_PASS = 'password123'; 
const CANVAS_TEACHER_EMAIL = process.env.CANVAS_TEACHER_EMAIL || 'profesor@canvas.local';
// semgrep-ignore
// eslint-disable-next-line
const CANVAS_TEACHER_PASS = 'password123';
// semgrep-ignore
// eslint-disable-next-line
const CANVAS_STUDENT_PASS = 'password123';

if (!process.env.CANVAS_ADMIN_PASS) {
  boot.info('Usando contraseñas por defecto para cuentas de prueba locales.');
}

function printCanvasCredentials() {
  boot.withStage('Credenciales de Canvas LMS', () => {
    boot.info(`[Administrador] ${CANVAS_ADMIN_EMAIL} / ${CANVAS_ADMIN_PASS}`);
    boot.info(`[Profesores]    ${CANVAS_TEACHER_EMAIL} … profesor3@canvas.local / ${CANVAS_TEACHER_PASS}`);
    boot.info(`[Estudiantes]   estudiante1@canvas.local … estudiante5@canvas.local / ${CANVAS_STUDENT_PASS}`);
  });
}

async function handleSpecialModes(mode) {
  if (mode === '4') {
    const passed = await boot.withStage('Validaciones de caja negra', async () => runBlackBoxTests(PLUGIN_DIR));
    await ask('\nPresione Enter para salir...');
    process.exit(passed ? 0 : 1);
  }

  if (mode === '2') {
    const { runDeploymentSetup } = await import('../commands/deploy.js');
    await runDeploymentSetup();
    process.exit(0);
  }
}

async function prepareEnvironment(mode, checker) {
  const checks = await checker.runAll(mode);
  if (checks.nodeRes && !checks.nodeRes.ok && checks.nodeRes.critical) {
    throw new Error(`${checks.nodeRes.message}. ${checks.nodeRes.fix}`);
  }
  process.env.STARTUP_MODE = mode;
  process.env.NON_INTERACTIVE = 'true';
  writeEnvOverrides(PLUGIN_DIR, mode, false);
}

async function configureMode(mode, localOrchestrator, checker) {
  if (mode === '3') {
    await localOrchestrator.setupLocalCanvas(mode);
    printCanvasCredentials();
  } else {
    boot.info('Esperando lanzamiento LTI 1.3 desde Canvas.');
    boot.info('OIDC: https://localhost:8080/api/lti/authorize_redirect · Callback: https://localhost:3000/api/lti/callback');
    boot.info('El navegador no se abrirá automáticamente.');

    await checker.runCheck('Verificación LTI (no local)', async () => {
      const lti = new LtiBootstrap({ mode, log: boot });
      return lti.run();
    });
  }
}

async function startServices(mode, localOrchestrator) {
  let backend;
  await boot.withStage('Arranque del backend y proxy', async () => {
    const requiredPorts = mode === '1' ? [SERVER_PORT] : [VITE_PORT, SERVER_PORT];
    await assertPortsAvailable(...requiredPorts);
    boot.success('Puertos requeridos disponibles.');
    boot.info('Iniciando servicios de backend y base de datos...');
    try {
      backend = spawnBackend();
      await waitForBackend(backend);
      boot.success('Conexión a PostgreSQL y migraciones completadas.');
      boot.info('Generando claves LTI y cargando certificados TLS (mkcert)...');
      boot.success('Autoconfiguración HTTPS Completada.');
      boot.success('Backend principal escuchando en el puerto 3000.');
      
      if (mode === '3' && localOrchestrator) {
        const proxyStarted = await localOrchestrator.startTlsProxy();
        if (!proxyStarted) throw new Error('No se pudo iniciar el proxy TLS requerido para Canvas Local.');
        boot.success('Proxy TLS interno activo (https://localhost:8443 -> HTTP 8080).');
      }
    } catch (err) {
      boot.error(`No se pudo iniciar el backend: ${err.message}`);
      if (process.env.NON_INTERACTIVE !== 'true') await ask('Presione Enter para salir...');
      throw err;
    }

    if (mode !== '1') {
      const viteSpinner = (await import('nanospinner')).createSpinner('Iniciando frontend (Vite)...');
      viteSpinner.start();
      spawnVite();
      viteSpinner.success({ text: `Proceso de desarrollo Vite iniciado (puerto ${VITE_PORT}).`, mark: '  √' });
    } else {
      boot.info('Modo de Producción: Sirviendo frontend desde /dist (Requiere ejecución previa de npm run build)');
    }
  });
  return backend;
}

export async function main({ mode: requestedMode } = {}) {
  let backend = null;
  let localOrchestrator = null;
  let shutdownHandler = null;

  try {
    const setupCompletePath = path.join(PLUGIN_DIR, '.setup_complete');
    if (fs.existsSync(setupCompletePath) && fs.existsSync(CANVAS_DIR) && fs.existsSync(getAssetsMarker(CANVAS_DIR))) {
      process.env.FAST_BOOT = 'true';
      boot.plain('  · Modo Fast Boot detectado y validado (.setup_complete y assets presentes).');
    }

    const mode = requestedMode || await showMainMenu();
    await handleSpecialModes(mode);

    const checker = new StaticChecker(PLUGIN_DIR);
    await prepareEnvironment(mode, checker);



    if (mode === '3') {
      const { Orchestrator } = await import('../local/index.js');
      localOrchestrator = new Orchestrator(boot, PLUGIN_DIR, CANVAS_DIR);
    }
    
    await configureMode(mode, localOrchestrator, checker);

    backend = await startServices(mode, localOrchestrator);
    shutdownHandler = setupGracefulShutdown(backend, localOrchestrator);

    if (mode === '3') {
      await localOrchestrator.waitForCanvasAndOpenBrowser();
    }

    if (mode === '3' && process.env.FAST_BOOT !== 'true') {
      fs.writeFileSync(setupCompletePath, '1');
      boot.plain('  √ Archivo .setup_complete generado (Fast Boot para el próximo arranque).');
    }

    boot.plain('');
    boot.plain('  ✨ Arranque completado. El plugin Feedback está operativo.');
    boot.plain('  Mantenga esta consola abierta. Presione Ctrl+C para detener.');
    boot.plain('');

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
        await stopBackend(backend);
        await stopVite();
      } catch { /* ignore */ }
      process.exit(1);
    }
  }
}
