import { execFileSync } from 'node:child_process';
import pc from 'picocolors';
import { ask } from './cli.js'; // Asumiendo que cli.js exporta ask y está en la misma carpeta

export async function runBlackBoxTests(pluginDir) {
  console.log('\n' + pc.cyan('========================================================='));
  console.log('  ' + pc.bold(pc.white('SUITE DE PRUEBAS Y CAJA NEGRA')));
  console.log(pc.cyan('========================================================='));
  console.log('  ' + pc.yellow('[A]') + ' Ejecutar Tests Locales de Código ' + pc.dim('(Vitest - 169+ tests actuales)'));
  console.log('      ' + pc.dim('No requiere Canvas ni Internet, chequeo profundo del código.'));
  console.log('  ' + pc.yellow('[B]') + ' Smoke Tests: Verificación de Salud LTI & API Token');
  console.log('      ' + pc.dim('Chequea si tu JWKS URL y Token son válidos en Canvas.'));
  console.log('  ' + pc.yellow('[C]') + ' E2E Playwright: Simulación LTI en Canvas Local ' + pc.dim('(Docker)'));
  console.log('      ' + pc.dim('Lanza un navegador fantasma, entra a tu Canvas local y prueba LTI.'));
  console.log('  ' + pc.yellow('[D]') + ' E2E Playwright: Simulación LTI en Canvas Real ' + pc.dim('(UNAB)'));
  console.log('      ' + pc.dim('Navega y valida todo el flujo OIDC en la nube (req. cuenta).'));
  console.log(pc.cyan('========================================================='));
  
  const option = (await ask('Seleccione una opcion (A-D)', 'A')).toUpperCase();

  switch (option) {
    case 'A':
      runVitestLocal(pluginDir);
      break;
    case 'B':
      runSmokeTests(pluginDir);
      break;
    case 'C':
      runPlaywrightTests(pluginDir, 'local');
      break;
    case 'D':
      runPlaywrightTests(pluginDir, 'real');
      break;
    default:
      console.log(pc.red('Opción no válida.'));
      break;
  }
}

function runVitestLocal(pluginDir) {
  console.log(pc.blue('\n[run] Ejecutando suite de validacion de caja negra local (Vitest)...'));
  try {
    const output = execFileSync('npx', ['vitest', 'run', 'src/validation/'], {
      cwd: pluginDir,
      encoding: 'utf8',
      stdio: 'inherit' // Muestra los colores de vitest
    });
    console.log(pc.green('\n[run] Suite completada con éxito.'));
  } catch (error) {
    console.error(pc.red('\n[run] La suite de validacion encontro fallos.'));
  }
}

function runSmokeTests(pluginDir) {
  console.log(pc.blue('\n[run] Ejecutando Smoke Tests de Salud de la API y JWKS...'));
  try {
    execFileSync('node', ['src/e2e/smoke.mjs'], {
      cwd: pluginDir,
      encoding: 'utf8',
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(pc.red('\n[run] Los Smoke Tests fallaron. Revisa tu red o configuración .env.'));
  }
}

function runPlaywrightTests(pluginDir, envType) {
  console.log(pc.blue(`\n[run] Ejecutando simulación Playwright E2E contra entorno: ${envType.toUpperCase()}...`));
  const envVar = envType === 'real' ? 'E2E_TARGET=real' : 'E2E_TARGET=local';
  
  try {
    // Usamos npx playwright test apuntando al directorio de E2E
    execFileSync('npx', ['cross-env', envVar, 'playwright', 'test', 'src/e2e/lti-flow.spec.js', '--headed=false'], {
      cwd: pluginDir,
      encoding: 'utf8',
      stdio: 'inherit'
    });
    console.log(pc.green('\n[run] Pruebas E2E completadas. Todo el flujo LTI funcionó correctamente.'));
  } catch (error) {
    console.error(pc.red('\n[run] Las pruebas E2E encontraron fallos o la conexión OIDC falló.'));
    console.log(pc.yellow('Recuerda ejecutar `npx playwright install` si es la primera vez que usas Playwright.'));
  }
}
