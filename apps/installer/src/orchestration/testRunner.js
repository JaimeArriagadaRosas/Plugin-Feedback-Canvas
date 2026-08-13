import { execFileSync, spawn } from 'node:child_process';

import pc from 'picocolors';

import { getE2ETargetConfig } from '../../../client/tests/e2e/ltiTargetConfig.mjs';
import { ask } from './cli.js';

export async function runBlackBoxTests(pluginDir) {
  printMenu();
  const option = (await ask('Seleccione una opcion (1-5)', '1')).toUpperCase();

  switch (option) {
    case '1': return runVitestLocal(pluginDir);
    case '2': return withServer('1', pluginDir, () => runSmokeTests(pluginDir), { USE_LOCAL_DATA: 'true' });
    case '3': return withServer('3', pluginDir, () => runPlaywrightTests(pluginDir, 'local'), {}, 300000);
    case '4': return runPlaywrightTests(pluginDir, 'real');
    case '5': return runStressSuite(pluginDir);
    default:
      console.log(pc.red('Opcion no valida.'));
      return false;
  }
}

function printMenu() {
  console.log(`\n${pc.cyan('=========================================================')}`);
  console.log(`  ${pc.bold(pc.white('SUITE DE PRUEBAS Y CAJA NEGRA'))}`);
  console.log(pc.cyan('========================================================='));
  console.log(`  ${pc.yellow('[1]')} Ejecutar tests locales de codigo ${pc.dim('(Vitest)')}`);
  console.log(`  ${pc.yellow('[2]')} Smoke tests de salud local ${pc.dim('(Health y JWKS)')}`);
  console.log(`  ${pc.yellow('[3]')} E2E Playwright contra Canvas local ${pc.dim('(Docker)')}`);
  console.log(`  ${pc.yellow('[4]')} E2E Playwright contra Canvas real ${pc.dim('(requiere URL y cuenta)')}`);
  console.log(`  ${pc.yellow('[5]')} Pruebas de estres ${pc.dim('(Autocannon)')}`);
  console.log(pc.cyan('========================================================='));
}

async function withServer(mode, pluginDir, runTest, envOverrides = {}, timeoutMs = 90000) {
  console.log(pc.blue(`\n  [Orquestador] Iniciando servidor temporal (modo ${mode})...`));
  return new Promise((resolve) => {
    let ready = false;
    let settled = false;
    let startupTimeout;
    const server = spawn('node', ['apps/installer/src/preboot.js', `--mode=${mode}`], {
      cwd: pluginDir,
      env: { ...process.env, NON_INTERACTIVE: 'true', STARTUP_MODE: mode, ...envOverrides }
    });
    const finish = (success) => {
      if (settled) return;
      settled = true;
      if (startupTimeout) clearTimeout(startupTimeout);
      if (!server.killed) server.kill('SIGINT');
      resolve(success);
    };
    startupTimeout = setTimeout(() => {
      console.error(pc.red(`\n  [Orquestador] El servidor no estuvo listo en ${Math.round(timeoutMs / 1000)} segundos.`));
      finish(false);
    }, timeoutMs);

    server.stdout.on('data', async (data) => {
      const output = data.toString();
      process.stdout.write(pc.dim('    [Server] ') + output);
      if (ready || !isReadyOutput(output)) return;
      ready = true;
      try {
        finish((await runTest()) !== false);
      } catch (error) {
        console.error(pc.red(`\n  [Orquestador] La prueba fallo: ${error.message}`));
        finish(false);
      }
    });
    server.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(pc.red('    [Server Error] ') + output);
      if (!ready && output.includes('Error critico')) finish(false);
    });
    server.on('error', (error) => {
      console.error(pc.red(`\n  [Orquestador] No se pudo iniciar el servidor: ${error.message}`));
      finish(false);
    });
    server.on('close', (code) => {
      if (!settled && !ready) {
        console.error(pc.red(`\n  [Orquestador] El proceso termino prematuramente con codigo ${code}.`));
        finish(false);
      }
    });
  });
}

function isReadyOutput(output) {
  return output.includes('Arranque completado') || output.includes('escuchando en el puerto 3000');
}

function runVitestLocal(pluginDir) {
  return runProcess(npxCommand(), ['--no-install', 'vitest', 'run', 'apps/server/tests/'], pluginDir,
    'La suite local encontro fallos o no pudo ejecutarse.');
}

function runSmokeTests(pluginDir) {
  return runProcess('node', ['apps/server/tests/e2e/smoke.mjs'], pluginDir,
    'Los smoke tests fallaron.', { NODE_OPTIONS: '--no-warnings' });
}

function runPlaywrightTests(pluginDir, target) {
  let configuration;
  try {
    configuration = getE2ETargetConfig({ ...process.env, E2E_TARGET: target });
  } catch (error) {
    console.error(pc.red(`\n  [E2E] Configuracion invalida: ${error.message}`));
    return false;
  }
  return runProcess(npxCommand(), ['--no-install', 'playwright', 'test',
    'apps/client/tests/e2e/lti-flow.spec.js'], pluginDir,
  'Las pruebas E2E fallaron. Verifique Canvas, el registro LTI y las credenciales.', {
    E2E_TARGET: target,
    CANVAS_URL: configuration.canvasUrl,
    CANVAS_TEST_USER: configuration.canvasUser,
    CANVAS_TEST_PASS: configuration.canvasPass,
    CANVAS_TEST_COURSE_ID: configuration.courseId
  });
}

async function runStressSuite(pluginDir) {
  const scenarios = [
    ['baseline', 'Baseline de rendimiento', true],
    ['idempotency', 'Idempotencia', true],
    ['circuitbreaker', 'Circuit breaker', true],
    ['ratelimiter', 'Rate limiter', false]
  ];
  let passed = true;
  for (const [id, label, disableRateLimit] of scenarios) {
    console.log(pc.cyan(`\n  Ejecutando estres: ${label}`));
    const result = await withServer('1', pluginDir, () => runStressScenario(pluginDir, id, disableRateLimit), {
      USE_LOCAL_DATA: 'true',
      ...(disableRateLimit ? { DISABLE_RATE_LIMIT: 'true' } : {})
    });
    passed &&= result;
  }
  console.log(passed ? pc.green('\n  Estres finalizado correctamente.') : pc.red('\n  Estres finalizado con fallos.'));
  return passed;
}

function runStressScenario(pluginDir, scenario, disableRateLimit) {
  return runProcess('node', ['apps/server/tests/e2e/stress.mjs'], pluginDir,
    `El escenario de estres ${scenario} fallo.`, {
      USE_LOCAL_DATA: 'true',
      STRESS_SCENARIO: scenario,
      ...(disableRateLimit ? { DISABLE_RATE_LIMIT: 'true' } : {})
    });
}

function runProcess(command, args, cwd, failureMessage, env = {}) {
  try {
    execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
    return true;
  } catch {
    console.error(pc.red(`\n  × ${failureMessage}`));
    return false;
  }
}

function npxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}
