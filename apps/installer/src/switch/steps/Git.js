import { run, requireSuccess } from '../runner.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function changeBranch(ctx) {
  const status = requireSuccess(await run('git', ['status', '--porcelain=v1'], { cwd: ctx.root }), 'Git status').stdout;
  if (status) throw new Error('Local changes were detected after inspection. Branch switching cancelled.');
  const branch = ctx.git.destination;
  const args = ctx.git.localBranch ? ['switch', branch] : ['switch', '--track', '-c', branch, `origin/${branch}`];
  requireSuccess(await run('git', args, { cwd: ctx.root, timeout: 30000 }), 'Branch switch');
  boot.success(`Active branch: ${branch}`);
}
