import { run, requireSuccess } from '../runner.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function changeBranch(ctx) {
  const status = requireSuccess(await run('git', ['status', '--porcelain=v1'], { cwd: ctx.root }), 'Estado Git').stdout;
  if (status) throw new Error('Se encontraron modificaciones después del diagnóstico. No se cambia de rama.');
  const branch = ctx.git.destination;
  const args = ctx.git.localBranch ? ['switch', branch] : ['switch', '--track', '-c', branch, `origin/${branch}`];
  requireSuccess(await run('git', args, { cwd: ctx.root, timeout: 30000 }), 'Cambio de rama');
  boot.success(`Rama activa: ${branch}`);
}
