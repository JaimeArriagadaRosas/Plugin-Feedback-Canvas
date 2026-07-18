import { execSync } from 'node:child_process';

export function runBlackBoxTests(pluginDir) {
  console.log('[run] Ejecutando suite de validacion de caja negra...');
  try {
    const output = execSync('npx vitest run src/validation/', {
      cwd: pluginDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(output);
    console.log('[run] Suite completada. Revise el reporte para detalles.');
  } catch (error) {
    console.error('[run] La suite de validacion encontro fallos.');
    console.log(error.stdout || error.message);
  }
}
