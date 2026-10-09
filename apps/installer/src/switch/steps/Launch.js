import { spawn } from 'node:child_process';
import { boot } from '../../orchestration/boot/logger.js';
export function launch(ctx, state) {
  boot.info('Iniciando nuevo proceso desde la rama de destino (modo 3)...');
  const child = spawn(process.execPath, ['apps/installer/src/preboot.js', '--mode=3'], {
    cwd: ctx.root, env: { ...process.env, STARTUP_MODE: '3', NON_INTERACTIVE: 'true', FAST_BOOT: '' }, stdio: 'inherit'
  });
  child.on('error', error => {
    boot.error(`No se pudo lanzar modo 3: ${error.message}`);
    process.exitCode = 1;
    state.stage('launch-error', 'failed').catch(e => boot.warn(e.message));
  });
  child.on('exit', (code, signal) => {
    const ok = code === 0 && !signal;
    process.exitCode = ok ? 0 : (code || 1);
    state.stage('mode-3-exit', ok ? 'ended' : 'failed').catch(e => boot.warn(e.message));
  });
  return child;
}
