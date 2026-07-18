import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { boot } from './boot/logger.js';
import { BootResult } from './boot/result.js';
import { EnvironmentDetector } from './boot/environment.js';
import { DockerCheck } from './boot/checks/docker.js';
import { NodeCheck } from './boot/checks/node.js';
import { DependenciesCheck } from './boot/checks/dependencies.js';
import { CanvasCheck } from './boot/checks/canvas.js';
import { LtiBootstrap } from './boot/lti.js';

import { clearPorts } from './portManager.js';
import { ask, showMainMenu, showApiTokenMenu } from './cli.js';
import { runBlackBoxTests } from './testRunner.js';
import { writeEnvOverrides, updateEnvVars, getEnvVar } from './envWriter.js';
import { runPythonVerify } from './python.js';
import { spawnVite, spawnBackend, VITE_PORT, SERVER_PORT } from './process.js';
import { openBrowser, waitForCanvasReady } from './browser.js';
import { getStudentProfiles } from '../config/student-profiles.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(__dirname, '..', '..', '..', '..');
const CANVAS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'canvas-lms-master');

const CANVAS_ADMIN_EMAIL = process.env.CANVAS_ADMIN_EMAIL || 'admin@canvas.local';
const CANVAS_ADMIN_PASS = process.env.CANVAS_ADMIN_PASS || 'adminpassword123';
const CANVAS_TEACHER_EMAIL = process.env.CANVAS_TEACHER_PASS ? process.env.CANVAS_TEACHER_EMAIL || 'profesor@canvas.local' : 'profesor@canvas.local';
const CANVAS_TEACHER_PASS = process.env.CANVAS_TEACHER_PASS || 'teacherpassword123';
const CANVAS_STUDENT_PASS = process.env.CANVAS_STUDENT_PASS || 'estudiantepass';

if (!process.env.CANVAS_ADMIN_PASS) {
  boot.info('Usando contraseñas por defecto para cuentas de prueba locales.');
}

/** Ejecuta una verificación y presenta su resultado de forma uniforme. */
async function runCheck(stageName, checkFn) {
  return boot.withStage(stageName, async () => {
    const result = await checkFn();
    if (result.degraded && result.ok) {
      boot.warn(result.message);
      if (result.fix) boot.action(result.fix);
    } else if (!result.ok) {
      boot.error(result.message);
      if (result.fix) boot.action(result.fix);
    }
    return result;
  });
}

/** Espera a que el backend escuche, con timeout corto y sin falsos errores. */
function waitForBackend(backend) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      backend.removeListener('error', onError);
      backend.removeListener('exit', onExit);
      clearTimeout(timer);
      fn();
    };
    const onError = (err) => finish(() => reject(err));
    const onExit = (code) => finish(() => {
      if (code !== 0 && code !== null) reject(new Error(`Backend cerrado con código ${code}`));
      else resolve();
    });
    backend.on('error', onError);
    backend.on('exit', onExit);
    const timer = setTimeout(() => finish(resolve), 4000); // 4s: el server arranca en ms
  });
}

/** Verificaciones independientes que pueden correr en paralelo. */
async function runStaticChecks(mode) {
  const docker = new DockerCheck();
  const nodeChk = new NodeCheck();
  const deps = new DependenciesCheck(PLUGIN_DIR);
  const env = new EnvironmentDetector(PLUGIN_DIR);

  env.ensureEnvFile(boot);
  env.ensureStartupVars(mode);

  const [dockerRes, nodeRes, depsRes, envRes] = await Promise.all([
    runCheck('Entorno Docker', () => docker.run(boot)),
    runCheck('Node.js / NPM', () => nodeChk.run(boot)),
    runCheck('Dependencias del plugin', () => deps.run(boot)),
    runCheck('Variables de entorno', () => Promise.resolve(env.validate(boot, mode))),
  ]);

  return { dockerRes, nodeRes, depsRes, envRes, env };
}

export async function main() {
  try {
    await boot.withStage('Preparación de puertos', async () => {
      await clearPorts(VITE_PORT, SERVER_PORT);
      boot.success('Puertos liberados.');
    });

    const mode = await showMainMenu();

    if (mode === '4') {
      await boot.withStage('Validaciones de caja negra', async () => runBlackBoxTests(PLUGIN_DIR));
      await ask('\nPresione Enter para salir...');
      process.exit(0);
    }

    const { env } = await runStaticChecks(mode);

    if (mode === '3') {
      process.env.STARTUP_MODE = mode;
      process.env.NON_INTERACTIVE = 'true';
      writeEnvOverrides(PLUGIN_DIR, mode, false);

      // Verificación + instalación de Canvas (capa Python). Crítica.
      const canvasRes = await runCheck('Verificación e instalación de Canvas LMS', async () => {
        try {
          await runPythonVerify();
          return BootResult.ok({ installed: true });
        } catch (e) {
          boot.error(e.message);
          if (e.output) {
            e.output.split('\n').filter(l => l.trim()).slice(-20).forEach(l => boot.debug(l));
          }
          throw e;
        }
      });

      // LTI: instala/activa solo en modo local. Nunca rompe el botón Feedback.
      await runCheck('Inicialización LTI 1.3', async () => {
        const lti = new LtiBootstrap({ mode, log: boot });
        return lti.run();
      });

      if (!canvasRes.ok) {
        await ask('\nPresione Enter para salir...');
        process.exit(1);
      }

      printCanvasCredentials();
    } else {
      process.env.STARTUP_MODE = mode;
      process.env.NON_INTERACTIVE = 'true';
      writeEnvOverrides(PLUGIN_DIR, mode, false);

      if (mode === '2') {
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

      // En modos 1/2 no instalamos LTI local, pero sí verificamos que el botón
      // no desaparezca si Canvas local estuviera corriendo.
      await runCheck('Verificación LTI (no local)', async () => {
        const lti = new LtiBootstrap({ mode, log: boot });
        return lti.run();
      });
    }

    // En modo Canvas Local, arrancaremos el proxy TLS inverso más adelante (después del backend).

    // Arranque de procesos (secuencial: backend primero, luego Vite).
    await boot.withStage('Arranque del backend', async () => {
      boot.info('Iniciando servidor backend...');
      let backend;
      try {
        backend = spawnBackend();
        await waitForBackend(backend);
        boot.success('Backend escuchando en :3000.');
        
        // Arrancamos el proxy TLS inverso del host ahora que sabemos que
        // el backend garantizó la existencia de los certificados.
        if (mode === '3') {
          try {
            const { startTlsProxy } = await import('./tlsProxy.js');
            startTlsProxy();
          } catch (err) {
            boot.warn(`No se pudo iniciar el proxy TLS para Canvas: ${err.message}`);
            boot.action('El flujo LTI requiere HTTPS; ejecute scripts/tls-proxy manualmente.');
          }
        }
      } catch (err) {
        boot.error(`No se pudo iniciar el backend: ${err.message}`);
        await ask('Presione Enter para salir...');
        process.exit(1);
      }

      const viteSpinner = (await import('nanospinner')).createSpinner('Iniciando frontend (Vite)...');
      viteSpinner.start();
      spawnVite();
      viteSpinner.success({ text: 'Frontend iniciado localmente' });
    });

      if (mode === '3') {
        await boot.withStage('Canvas LMS (espera de listo)', async () => {
          const spinner = (await import('nanospinner')).createSpinner('Canvas LMS inicializándose en segundo plano...');
          spinner.start();
          try {
            await waitForCanvasReady();
            spinner.success({ text: 'Canvas LMS listo' });
            // Canvas ahora se sirve como HTTPS vía el proxy TLS inverso
            // (scripts/tls-proxy) en el puerto 8443, que reenvía al contenedor
            // Docker HTTP en 8080. El navegador accede por HTTPS sin errores.
            const canvasBrowserUrl = 'https://localhost:8443/login/canvas';
            boot.info(`Abriendo ${canvasBrowserUrl} ...`);
            await openBrowser(canvasBrowserUrl);
          } catch (err) {
            spinner.error({ text: 'No se pudo detectar que Canvas estuviera listo' });
            boot.warn(err.message);
            boot.action('Abra manualmente: https://localhost:8443/');
          }
        });
      }

    boot.success('Arranque completado. El plugin Feedback está operativo.');
    boot.info('Mantenga esta consola abierta. Presione Ctrl+C para detener.');

    // Mantener el proceso vivo escuchando el cierre del backend.
    process.on('SIGINT', async () => {
      boot.info('Deteniendo...');
      try {
        const { stopTlsProxy } = await import('./tlsProxy.js');
        stopTlsProxy();
      } catch { /* ignore */ }
      process.exit(0);
    });

  } catch (e) {
    boot.error(e.message);
    await ask('\nPresione Enter para salir...');
    process.exit(1);
  }
}

function printCanvasCredentials() {
  boot.withStage('Credenciales de Canvas LMS', () => {
    boot.info(`[Administrador] ${CANVAS_ADMIN_EMAIL} / ${CANVAS_ADMIN_PASS}`);
    boot.info(`[Profesor]     ${CANVAS_TEACHER_EMAIL} / ${CANVAS_TEACHER_PASS}`);
    boot.info(`[Estudiantes]  estudiante1@canvas.local … estudiante5@canvas.local / ${CANVAS_STUDENT_PASS}`);
  });
}
