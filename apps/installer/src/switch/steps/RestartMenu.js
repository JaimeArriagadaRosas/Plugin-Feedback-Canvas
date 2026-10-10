import { spawn } from 'node:child_process';
import { boot } from '../../orchestration/boot/logger.js';
export function restartMenu(ctx, state) {
  const env = { ...process.env, NON_INTERACTIVE: 'false' };
  delete env.STARTUP_MODE;
  delete env.FAST_BOOT;
  delete env.npm_config_argv;
  console.clear();
  const child = spawn(process.execPath, ['apps/installer/src/preboot.js'], { cwd: ctx.root, env, stdio: 'inherit', windowsHide: false });
  child.once('error', async error => { boot.error('Could not launch destination menu: ' + error.message); process.exitCode = 1; await state.stage('menu-error', 'failed'); });
  child.once('exit', async (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); await state.stage('menu-ended', 'ended'); });
  return child;
}
