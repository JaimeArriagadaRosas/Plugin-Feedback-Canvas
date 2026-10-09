import { spawn } from 'node:child_process';
import { boot } from '../../orchestration/boot/logger.js';
export function launch(ctx) {
  boot.info('Iniciando nuevo proceso desde la rama de destino (modo 3)...');
  const child = spawn(process.execPath, ['apps/installer/src/preboot.js', '--mode=3'], {
    cwd: ctx.root, env: { ...process.env, STARTUP_MODE: '3', NON_INTERACTIVE: 'true', FAST_BOOT: '' }, stdio: 'inherit'
  });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code || (signal ? 1 : 0); });
}
