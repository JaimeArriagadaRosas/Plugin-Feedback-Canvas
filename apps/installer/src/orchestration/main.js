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
import { getCanvasDirectory, getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';

dotenv.config({ quiet: true });

const PLUGIN_DIR = getPluginDirectory();
const CANVAS_DIR = getCanvasDirectory();

const CANVAS_ADMIN_EMAIL = process.env.CANVAS_ADMIN_EMAIL || 'admin@canvas.local';
// semgrep-ignore
// eslint-disable-next-line
const CANVAS_ADMIN_PASS = 'password123'; 
const CANVAS_TEACHER_EMAIL = process.env.CANVAS_TEACHER_EMAIL || 'teacher@canvas.local';
// semgrep-ignore
// eslint-disable-next-line
const CANVAS_TEACHER_PASS = 'password123';
// semgrep-ignore
// eslint-disable-next-line
const CANVAS_STUDENT_PASS = 'password123';

if (!process.env.CANVAS_ADMIN_PASS) {
  boot.info('Using default passwords for local test accounts.');
}

function printCanvasCredentials() {
  boot.withStage('Canvas LMS Credentials', () => {
    boot.info(`[Administrator] ${CANVAS_ADMIN_EMAIL} / ${CANVAS_ADMIN_PASS}`);
    boot.info(`[Teachers]      ${CANVAS_TEACHER_EMAIL} … teacher3@canvas.local / ${CANVAS_TEACHER_PASS}`);
    boot.info(`[Students]      student1@canvas.local … student5@canvas.local / ${CANVAS_STUDENT_PASS}`);
  });
}

async function handleSpecialModes(mode) {
  if (mode === '4') {
    const passed = await boot.withStage('Black-Box Validation', async () => runBlackBoxTests(PLUGIN_DIR));
    await ask('\nPress Enter to exit...');
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
    boot.info('Waiting for LTI 1.3 launch from Canvas.');
    boot.info('OIDC: https://localhost:8080/api/lti/authorize_redirect · Callback: https://localhost:3000/api/lti/callback');
    boot.info('The browser will not open automatically.');

    await checker.runCheck('LTI Verification (non-local)', async () => {
      const lti = new LtiBootstrap({ mode, log: boot });
      return lti.run();
    });
  }
}

async function startServices(mode, localOrchestrator) {
  let backend;
  await boot.withStage('Backend and proxy startup', async () => {
    const requiredPorts = mode === '1' ? [SERVER_PORT] : [VITE_PORT, SERVER_PORT];
    await assertPortsAvailable(...requiredPorts);
    boot.success('Required ports are available.');
    boot.info('Starting backend and database services...');
    try {
      backend = spawnBackend();
      await waitForBackend(backend);
      boot.success('PostgreSQL connection established and migrations complete.');
      boot.info('Generating LTI keys and loading TLS certificates (mkcert)...');
      boot.success('HTTPS auto-configuration complete.');
      boot.success('Main backend listening on port 3000.');
      
      if (mode === '3' && localOrchestrator) {
        const proxyStarted = await localOrchestrator.startTlsProxy();
        if (!proxyStarted) throw new Error('Failed to start the TLS proxy required for local Canvas.');
        boot.success('Internal TLS proxy active (https://localhost:8443 -> HTTP 8080).');
      }
    } catch (err) {
      boot.error(`Failed to start backend: ${err.message}`);
      if (process.env.NON_INTERACTIVE !== 'true') await ask('Press Enter to exit...');
      throw err;
    }

    if (mode !== '1') {
      const viteSpinner = (await import('nanospinner')).createSpinner('Starting frontend (Vite)...');
      viteSpinner.start();
      spawnVite();
      viteSpinner.success({ text: `Vite development process started (port ${VITE_PORT}).`, mark: '  √' });
    } else {
      boot.info('Production Mode: Serving frontend from /dist (requires prior execution of npm run build)');
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
    if (fs.existsSync(setupCompletePath)) {
      process.env.FAST_BOOT = 'true';
      boot.plain('  · Fast Boot mode detected (.setup_complete present).');
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

    if (mode === '3' && !process.env.FAST_BOOT) {
      fs.writeFileSync(setupCompletePath, '1');
      boot.plain('  √ .setup_complete file created (Fast Boot for next startup).');
    }

    boot.plain('');
    boot.plain('  ✨ Startup complete. The Feedback plugin is operational.');
    boot.plain('  Keep this console open. Press Ctrl+C to stop.');
    boot.plain('');

  } catch (e) {
    boot.error(`Critical error: ${e.message}`);
    if (e.stack) boot.debug(e.stack);
    
    boot.info('Running cleanup on error (Graceful Shutdown)...');
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
