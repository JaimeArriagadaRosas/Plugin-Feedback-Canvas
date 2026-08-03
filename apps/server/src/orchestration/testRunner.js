import { execFileSync, spawn } from 'node:child_process';
import pc from 'picocolors';
import { ask } from './cli.js'; // Asumiendo que cli.js exporta ask y está en la misma carpeta

export async function runBlackBoxTests(pluginDir) {
  console.log('\n' + pc.cyan('========================================================='));
  console.log('  ' + pc.bold(pc.white('SUITE DE PRUEBAS Y CAJA NEGRA')));
  console.log(pc.cyan('========================================================='));
  console.log('  ' + pc.yellow('[1]') + ' Ejecutar Tests Locales de Código ' + pc.dim('(Vitest - 9 tests actuales)'));
  console.log('      ' + pc.dim('No requiere Canvas ni Internet, chequeo profundo del código.'));
  console.log('  ' + pc.yellow('[2]') + ' Smoke Tests: Verificación de Salud Local ' + pc.dim('(Health y JWKS)'));
  console.log('      ' + pc.dim('Inicia un servidor simulado para comprobar que responde y expone llaves LTI.'));
  console.log('  ' + pc.yellow('[3]') + ' E2E Playwright: Simulación LTI en Canvas Local ' + pc.dim('(Docker)'));
  console.log('      ' + pc.dim('Lanza un navegador fantasma, entra a tu Canvas local y prueba LTI.'));
  console.log('  ' + pc.yellow('[4]') + ' E2E Playwright: Simulación LTI en Canvas Real ' + pc.dim('(UNAB)'));
  console.log('      ' + pc.dim('Navega y valida todo el flujo OIDC en la nube (req. cuenta).'));
  console.log('  ' + pc.yellow('[5]') + ' Pruebas de Estrés: Simular alta carga (Autocannon)');
  console.log('      ' + pc.dim('Satura los endpoints LTI para medir rendimiento y latencia.'));
  console.log(pc.cyan('========================================================='));
  
  const option = (await ask('Seleccione una opcion (1-5)', '1')).toUpperCase();

  switch (option) {
    case '1':
      runVitestLocal(pluginDir);
      break;
    case '2':
      await withServer('1', pluginDir, () => runSmokeTests(pluginDir), { USE_LOCAL_DATA: 'true' });
      break;
    case '3':
      await withServer('3', pluginDir, () => runPlaywrightTests(pluginDir, 'local'));
      break;
    case '4':
      await withServer('1', pluginDir, () => runPlaywrightTests(pluginDir, 'real'));
      break;
    case '5': {
      console.log(pc.cyan('\n╔═════════════════════════════════════════════════════════════╗'));
      console.log(pc.cyan('║') + pc.bold(pc.white('  PRUEBAS DE ESTRÉS Y RESILIENCIA — DEFENSE IN DEPTH     ')) + pc.cyan('║'));
      console.log(pc.cyan('║') + pc.dim('  Alineadas con docs/TESTING_AND_PERFORMANCE.md           ') + pc.cyan('║'));
      console.log(pc.cyan('║') + pc.dim('  Cada escenario usa un servidor fresco (aislamiento)     ') + pc.cyan('║'));
      console.log(pc.cyan('╚═════════════════════════════════════════════════════════════╝'));

      const scenarios = [
        { id: 'baseline',       label: 'Baseline de Rendimiento',             env: { DISABLE_RATE_LIMIT: 'true' } },
        { id: 'idempotency',    label: 'Idempotency Manager (Duplicidad)',    env: { DISABLE_RATE_LIMIT: 'true' } },
        { id: 'circuitbreaker', label: 'Circuit Breaker (Fallas Remotas)',    env: { DISABLE_RATE_LIMIT: 'true' } },
        { id: 'ratelimiter',    label: 'Rate Limiter (DDoS)',                 env: {} },
      ];

      const results = [];
      for (const scenario of scenarios) {
        console.log(pc.bold(pc.cyan(`\n── [${results.length + 1}/${scenarios.length}] ${scenario.label} ──`)));
        try {
          await withServer('1', pluginDir, () => {
            execFileSync('node', ['apps/server/tests/e2e/stress.mjs'], {
              cwd: pluginDir, encoding: 'utf8', stdio: 'inherit',
              env: { ...process.env, USE_LOCAL_DATA: 'true', STRESS_SCENARIO: scenario.id, ...scenario.env }
            });
          }, { USE_LOCAL_DATA: 'true', ...scenario.env });
          results.push({ label: scenario.label, pass: true });
        } catch {
          results.push({ label: scenario.label, pass: false });
        }
      }

      // ── Resumen final ──
      console.log(pc.cyan('\n╔═════════════════════════════════════════════════════════════╗'));
      console.log(pc.cyan('║') + pc.bold(pc.white('  RESUMEN FINAL DE ESTRÉS                                 ')) + pc.cyan('║'));
      console.log(pc.cyan('╠═════════════════════════════════════════════════════════════╣'));
      for (const r of results) {
        const icon = r.pass ? pc.green('✔') : pc.red('✘');
        console.log(pc.cyan('║') + `  ${icon} ${r.label.padEnd(50)}` + pc.cyan('║'));
      }
      const allPassed = results.every(r => r.pass);
      console.log(pc.cyan('╠═════════════════════════════════════════════════════════════╣'));
      console.log(pc.cyan('║') + (allPassed
        ? pc.bold(pc.green('  RESULTADO: TODOS LOS ESCENARIOS PASARON ✔                '))
        : pc.bold(pc.red('  RESULTADO: ALGUNOS ESCENARIOS FALLARON ✘                '))
      ) + pc.cyan('║'));
      console.log(pc.cyan('╚═════════════════════════════════════════════════════════════╝\n'));
      break;
    }
    default:
      console.log(pc.red('Opción no válida.'));
      break;
  }
}

/**
 * Arranca automáticamente la infraestructura necesaria, ejecuta la prueba, y la apaga.
 */
async function withServer(mode, pluginDir, testCallback, envOverrides = {}) {
  console.log(pc.blue(`\n  [Orquestador] Iniciando servidor (Opción ${mode}) - Streaming de logs activo...`));
  
  return new Promise((resolve) => {
    const serverProcess = spawn('node', ['apps/server/src/preboot.js'], {
      cwd: pluginDir,
      env: { ...process.env, NON_INTERACTIVE: 'true', STARTUP_MODE: mode, ...envOverrides }
    });

    let isReady = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Mostrar el log del servidor en tiempo real (con un pequeño indent para diferenciarlo)
      process.stdout.write(pc.dim('    [Server] ') + output.replace(/\n/g, `\n${pc.dim('    [Server] ')}`));

      if (output.includes('Arranque completado') || output.includes('escuchando en el puerto 3000')) {
        if (!isReady) {
          isReady = true;
          console.log(pc.green('  [Orquestador] Servidor listo. Ejecutando prueba...\n'));
          
          try {
            testCallback();
          } finally {
            console.log(pc.blue('\n  [Orquestador] Apagando infraestructura temporal...'));
            serverProcess.kill('SIGINT');
            resolve();
          }
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const errOut = data.toString();
      
      // Mostrar errores del servidor en tiempo real
      process.stderr.write(pc.red('    [Server Error] ') + errOut.replace(/\n/g, `\n${pc.red('    [Server Error] ')}`));

      if (!isReady && errOut.includes('Error crítico')) {
        console.error(pc.red(`\n  [Orquestador Error] Falló el arranque: ${errOut}`));
        serverProcess.kill('SIGINT');
        resolve();
      }
    });

    serverProcess.on('close', (code) => {
      if (!isReady) {
        console.log(pc.red(`\n  [Orquestador Error] El proceso terminó prematuramente con código ${code}`));
        resolve();
      }
    });
  });
}

function runVitestLocal(pluginDir) {
  console.log(pc.blue('\n  · Ejecutando suite de validacion de caja negra local (Vitest)...'));
  try {
    execFileSync('npx', ['vitest', 'run', 'apps/server/tests/'], {
      cwd: pluginDir,
      encoding: 'utf8',
      stdio: 'inherit', // Muestra los colores de vitest
      shell: true // Soporte cross-platform (Windows/Mac/Linux)
    });
    console.log(pc.green('\n  √ Suite completada con éxito.'));
  } catch (error) {
    console.error(pc.red('\n  × La suite de validacion encontro fallos o no pudo ejecutarse.'));
    if (error.code === 'ENOENT') {
      console.error(pc.yellow(`    ↳ Error: No se encontró el comando 'npx'. Asegúrate de tener Node.js instalado.`));
    }
  }
}

function runSmokeTests(pluginDir) {
  console.log(pc.blue('\n  · Ejecutando Smoke Tests de Salud de la API y JWKS (Modo Local Aisado)...'));
  try {
    execFileSync('node', ['apps/server/tests/e2e/smoke.mjs'], {
      cwd: pluginDir,
      encoding: 'utf8',
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--no-warnings' }
    });
  } catch (error) {
    console.error(pc.red('\n  × Los Smoke Tests fallaron debido a un error interno o del sistema.'));
    console.error(pc.yellow(`    ↳ Detalle del error: ${error.message}`));
  }
}

function runStressTests(pluginDir, rateLimitOff = false) {
  console.log(pc.cyan('\n╔═════════════════════════════════════════════════════════════╗'));
  console.log(pc.cyan('║') + pc.bold(pc.white('  PRUEBAS DE ESTRÉS Y RESILIENCIA — DEFENSE IN DEPTH     ')) + pc.cyan('║'));
  console.log(pc.cyan('║') + pc.dim('  Alineadas con docs/TESTING_AND_PERFORMANCE.md           ') + pc.cyan('║'));
  console.log(pc.cyan('║') + pc.dim('  Validando: Idempotencia · Rate Limit · Circuit Breaker  ') + pc.cyan('║'));
  console.log(pc.cyan('╚═════════════════════════════════════════════════════════════╝'));

  // Pasada 1 (rateLimitOff=true):  Baseline + Idempotency + Circuit Breaker
  // Pasada 2 (rateLimitOff=false): Solo Rate Limiter (servidor fresco, contadores limpios)
  const scenarios = rateLimitOff
    ? [
        { id: 'baseline',       label: 'Baseline de Rendimiento' },
        { id: 'idempotency',    label: 'Idempotency Manager (Duplicidad)' },
        { id: 'circuitbreaker', label: 'Circuit Breaker (Fallas Remotas)' }
      ]
    : [
        { id: 'ratelimiter',    label: 'Rate Limiter (DDoS)' }
      ];

  const childEnv = { ...process.env };
  if (rateLimitOff) childEnv.DISABLE_RATE_LIMIT = 'true';

  const results = [];

  for (const scenario of scenarios) {
    console.log(pc.blue(`\n  · Ejecutando: ${scenario.label}...`));
    try {
      execFileSync('node', ['apps/server/tests/e2e/stress.mjs'], {
        cwd: pluginDir,
        encoding: 'utf8',
        stdio: 'inherit',
        env: { ...childEnv, STRESS_SCENARIO: scenario.id }
      });
      results.push({ label: scenario.label, pass: true });
    } catch (error) {
      results.push({ label: scenario.label, pass: false });
    }
  }

  // ── Resumen consolidado ──
  console.log(pc.cyan('\n╔═════════════════════════════════════════════════════════════╗'));
  console.log(pc.cyan('║') + pc.bold(pc.white('  RESUMEN DE PRUEBAS DE ESTRÉS                            ')) + pc.cyan('║'));
  console.log(pc.cyan('╠═════════════════════════════════════════════════════════════╣'));

  for (const r of results) {
    const icon = r.pass ? pc.green('✔') : pc.red('✘');
    console.log(pc.cyan('║') + `  ${icon} ${r.label.padEnd(50)}` + pc.cyan('║'));
  }

  const allPassed = results.every(r => r.pass);
  console.log(pc.cyan('╠═════════════════════════════════════════════════════════════╣'));
  console.log(pc.cyan('║') + (allPassed
    ? pc.bold(pc.green('  RESULTADO: TODOS LOS ESCENARIOS PASARON ✔                '))
    : pc.bold(pc.red('  RESULTADO: ALGUNOS ESCENARIOS FALLARON ✘                '))
  ) + pc.cyan('║'));
  console.log(pc.cyan('╚═════════════════════════════════════════════════════════════╝\n'));

  if (!allPassed) {
    throw new Error('Stress tests failed');
  }
}

function runPlaywrightTests(pluginDir, envType) {
  console.log(pc.blue(`\n  · Ejecutando simulación Playwright E2E contra entorno: ${envType.toUpperCase()}...`));
  const envVar = envType === 'real' ? 'E2E_TARGET=real' : 'E2E_TARGET=local';
  
  try {
    execFileSync('npx', ['cross-env', envVar, 'playwright', 'test', 'apps/client/tests/e2e/lti-flow.spec.js', '--headed=false'], {
      cwd: pluginDir,
      encoding: 'utf8',
      stdio: 'inherit',
      shell: true // Soporte cross-platform (Windows/Mac/Linux)
    });
    console.log(pc.green('\n  √ Pruebas E2E completadas. Todo el flujo LTI funcionó correctamente.'));
  } catch (error) {
    console.error(pc.red('\n  × Las pruebas E2E encontraron fallos o la conexión OIDC falló.'));
    console.log(pc.yellow('  · Guía: Recuerda ejecutar `npx playwright install` si es la primera vez que usas Playwright.'));
  }
}
