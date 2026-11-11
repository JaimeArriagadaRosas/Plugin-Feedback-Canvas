import path from 'node:path';
import { SharedDependencyRecovery } from '../../apps/installer/src/recovery/SharedDependencyRecovery.js';

const owner = process.env.COMPOSE_PROJECT_NAME || '';
const mode = process.argv[2] || 'plan';
const authorized = process.env.QA_DISPOSABLE_LAB === 'true' &&
  process.env.PLUGIN_TEST_MODE === 'true' &&
  process.env.PLUGIN_QA_NO_BROWSER === 'true' &&
  /^qa-compat-[0-9a-f]{8}$/.test(owner);
if (!authorized) throw new Error('A uniquely owned disposable QA project is mandatory');
if (!['plan','approve','decline','candidate'].includes(mode)) throw new Error('Unknown QA mode');
const environment = { ...process.env, PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY: 'false' };
const recovery = new SharedDependencyRecovery({
  environment, composeFile: path.join('tools', 'qa', 'docker-compose.compat.yml')
});
const confirm = async (_question, defaultValue) => {
  if (defaultValue !== false) throw Error('Recovery permission must default to NO');
  return mode === 'approve';
};
const result = mode === 'plan' ? await recovery.plan(process.cwd())
  : mode === 'candidate' ? await recovery.previewStoppedRecovery(process.cwd())
    : await recovery.recoverWithConsent(process.cwd(), { confirm, maxPolls: 35, intervalMs: 750 });
console.log('QA_CONSENTED_RECOVERY=' + JSON.stringify({
  mode, kind: result.kind, recovered: result.recovered || [],
  states: result.services?.map(x => ({ service: x.service, state: x.state })) || [],
  stopped: result.stopped || [],
  reasonCategory: result.reason ? 'safely_blocked' : null
}));
if (mode === 'approve' && result.kind !== 'reuse') process.exitCode = 2;
