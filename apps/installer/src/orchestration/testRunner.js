import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';

import pc from 'picocolors';

import { getE2ETargetConfig } from '../../../client/tests/e2e/ltiTargetConfig.mjs';
import { ask } from './cli.js';
import { DataSeeder } from '../installation/DataSeeder.js';

export async function runBlackBoxTests(pluginDir) {
  printMenu();
  const option = (await ask('Select an option (1-5)', '1')).toUpperCase();

  switch (option) {
    case '1': return runVitestLocal(pluginDir);
    case '2': return withServer('1', pluginDir, () => runSmokeTests(pluginDir), { USE_LOCAL_DATA: 'true' });
    case '3': return withServer('3', pluginDir, () => runPlaywrightTests(pluginDir, 'local'), { TEST_MODE: 'true' }, 300000);
    case '4': return runPlaywrightTests(pluginDir, 'real');
    case '5': return runStressSuite(pluginDir);
    default:
      console.log(pc.red('Invalid option.'));
      return false;
  }
}

function printMenu() {
  console.log(`\n${pc.cyan('=========================================================')}`);
  console.log(`  ${pc.bold(pc.white('TEST SUITE AND BLACK BOX'))}`);
  console.log(pc.cyan('========================================================='));
  console.log(`  ${pc.yellow('[1]')} Run local code tests ${pc.dim('(Vitest)')}`);
  console.log(`  ${pc.yellow('[2]')} Local health smoke tests ${pc.dim('(Health y JWKS)')}`);
  console.log(`  ${pc.yellow('[3]')} E2E Playwright against local Canvas ${pc.dim('(Docker)')}`);
  console.log(`  ${pc.yellow('[4]')} E2E Playwright against real Canvas ${pc.dim('(requires URL and account)')}`);
  console.log(`  ${pc.yellow('[5]')} Stress tests ${pc.dim('(Autocannon)')}`);
  console.log(pc.cyan('========================================================='));
}

async function withServer(mode, pluginDir, runTest, envOverrides = {}, timeoutMs = 90000) {
  console.log(pc.blue(`\n  [Orchestrator] Starting temporary server (mode ${mode})...`));
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
      console.error(pc.red(`\n  [Orchestrator] The server was not ready in ${Math.round(timeoutMs / 1000)} seconds.`));
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
        console.error(pc.red(`\n  [Orchestrator] The test failed: ${error.message}`));
        finish(false);
      }
    });
    server.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(pc.red('    [Server Error] ') + output);
      if (!ready && output.includes('Critical error')) finish(false);
    });
    server.on('error', (error) => {
      console.error(pc.red(`\n  [Orchestrator] Could not start the server: ${error.message}`));
      finish(false);
    });
    server.on('close', (code) => {
      if (!settled && !ready) {
        console.error(pc.red(`\n  [Orchestrator] The process terminated prematurely with code ${code}.`));
        finish(false);
      }
    });
  });
}

function isReadyOutput(output) {
  return output.includes('Startup completed') || output.includes('listening on port 3000');
}

function runVitestLocal(pluginDir) {
  return runProcess(npxCommand(), ['--no-install', 'vitest', 'run', 'apps/server/tests/'], pluginDir,
    'The local suite found failures or could not be executed.');
}

function runSmokeTests(pluginDir) {
  return runProcess('node', ['apps/server/tests/e2e/smoke.mjs'], pluginDir,
    'The smoke tests failed.', { NODE_OPTIONS: '--no-warnings' });
}

async function runPlaywrightTests(pluginDir, target) {
  let configuration;
  try {
    configuration = getE2ETargetConfig({ ...process.env, E2E_TARGET: target });
  } catch (error) {
    console.error(pc.red(`\n  [E2E] Invalid configuration: ${error.message}`));
    return false;
  }

  if (target === 'local') {
    const mockBoot = { plain: console.log, error: console.error };
    const canvasDir = path.join(pluginDir, '..', 'canvas-lms-master');
    const seeder = new DataSeeder(mockBoot, pluginDir, canvasDir);
    const seeded = await seeder.seedData();
    if (!seeded) {
      console.error(pc.red('\n  [E2E] Test data injection failed.'));
      return false;
    }
  }
  return runProcess(npxCommand(), ['--no-install', 'playwright', 'test',
    'apps/client/tests/e2e/lti-flow.spec.js'], pluginDir,
  'E2E tests failed. Check Canvas, the LTI registration, and credentials.', {
    E2E_TARGET: target,
    CANVAS_URL: configuration.canvasUrl,
    CANVAS_TEST_USER: configuration.canvasUser,
    CANVAS_TEST_PASS: configuration.canvasPass,
    CANVAS_TEST_COURSE_ID: configuration.courseId
  });
}

async function runStressSuite(pluginDir) {
  const scenarios = [
    ['baseline', 'Performance baseline', true],
    ['idempotency', 'Idempotency', true],
    ['circuitbreaker', 'Circuit breaker', true],
    ['ratelimiter', 'Rate limiter', false]
  ];
  let passed = true;
  for (const [id, label, disableRateLimit] of scenarios) {
    console.log(pc.cyan(`\n  Running stress: ${label}`));
    const result = await withServer('1', pluginDir, () => runStressScenario(pluginDir, id, disableRateLimit), {
      USE_LOCAL_DATA: 'true',
      ...(disableRateLimit ? { DISABLE_RATE_LIMIT: 'true' } : {})
    });
    passed &&= result;
  }
  console.log(passed ? pc.green('\n  Stress completed successfully.') : pc.red('\n  Stress finished with failures.'));
  return passed;
}

function runStressScenario(pluginDir, scenario, disableRateLimit) {
  return runProcess('node', ['apps/server/tests/e2e/stress.mjs'], pluginDir,
    `The stress scenario ${scenario} failed.`, {
      USE_LOCAL_DATA: 'true',
      STRESS_SCENARIO: scenario,
      ...(disableRateLimit ? { DISABLE_RATE_LIMIT: 'true' } : {})
    });
}

function runProcess(command, args, cwd, failureMessage, env = {}) {
  try {
    execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
    return true;
  } catch (error) {
    console.error(pc.red(`\n  × ${failureMessage}`));
    if (error && error.message) {
      console.error(pc.dim(`    Detail: ${error.message} (Code: ${error.code || 'N/A'})`));
    }
    return false;
  }
}

function npxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}
