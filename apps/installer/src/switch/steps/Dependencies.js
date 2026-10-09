import { run, requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function prepareDependencies(ctx) {
  if (!ctx.plan.dependencies) { boot.info('Lockfile compatible: se conservan dependencias npm.'); return; }
  if (!await confirmAction({
    title: 'Reinstalar dependencias npm para la nueva rama',
    detail: 'npm ci reconstruirá exclusivamente node_modules del repositorio según el package-lock.json de destino.'
  })) throw new Error('El usuario rechazó reinstalar las dependencias requeridas.');
  requireSuccess(await run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: ctx.root, timeout: 600000 }), 'npm ci');
  boot.success('Dependencias npm instaladas para la rama de destino.');
}
