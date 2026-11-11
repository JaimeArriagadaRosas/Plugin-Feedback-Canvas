import { SharedDependencyRecovery } from '../../apps/installer/src/recovery/SharedDependencyRecovery.js';

const mode = process.argv[2] || 'plan';
const owner = process.env.COMPOSE_PROJECT_NAME || '';
if (process.env.QA_DISPOSABLE_LAB !== 'true' || !/^qa-compat-[0-9a-f]{8}$/.test(owner)) {
  throw new Error('Se requieren un proyecto Compose efímero verificable y el permiso QA_DISPOSABLE_LAB.');
}
if (!['plan', 'recover'].includes(mode)) throw new Error('Modo de recuperación inválido.');

const recovery = new SharedDependencyRecovery();
const result = mode === 'recover'
  ? await recovery.recoverOwnedStopped(process.cwd(), { maxPolls: 30, intervalMs: 600 })
  : await recovery.plan(process.cwd());

console.log('QA_RECOVERY=' + JSON.stringify({
  mode,
  kind: result.kind,
  reason: result.reason ? 'recovery_blocked' : null,
  recovered: result.recovered || [],
  services: result.services?.map(({ service, state, owner }) => ({ service, state, owner })) || []
}));
if (result.kind === 'block' && mode === 'recover') process.exitCode = 2;
