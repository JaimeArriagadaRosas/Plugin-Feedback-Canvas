import { run, requireSuccess } from '../runner.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function prepareDependencies(ctx) {
  if (!ctx.plan.dependencies) return;
  const packageManager = requireSuccess(await run('node', ['-p', "require('./package.json').packageManager"], { cwd: ctx.root }), 'packageManager').stdout;
  const version = /^npm@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1];
  if (!version) throw new Error('Unrecognized npm packageManager: ' + packageManager);
  requireSuccess(await run('npx', ['--yes', 'npm@' + version, 'ci', '--no-audit', '--no-fund'], { cwd: ctx.root, timeout: 900000 }), 'Install destination branch dependencies');
  boot.success('npm dependencies prepared with version ' + version);
}
