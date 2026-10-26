import { describe, it, expect } from 'vitest';
import { SharedDependencyRecovery } from '../../src/recovery/SharedDependencyRecovery.js';

const inspect = (name, state, service, owner = 'legacy-project') => ({
  stdout: JSON.stringify({ Config: { Labels: {
    'com.docker.compose.project': owner,
    'com.docker.compose.service': service
  } }, State: { Running: state === 'healthy', Health: { Status: state } } })
});
const fake = (states) => async (_command, args) => {
  const name = args[1];
  const state = states.find(s => s.name === name);
  if (!state) throw Object.assign(new Error('No such object'), { stderr: 'No such object' });
  return inspect(name, state.state, state.service);
};
describe('safe shared dependency recovery', () => {
  it('does not modify anything when healthy shared services can be reused', async () => {
    const service = new SharedDependencyRecovery({ exec: fake([
      { name: 'feedback_plugin_db_local', state: 'healthy', service: 'db' },
      { name: 'feedback_plugin_gotenberg_local', state: 'healthy', service: 'gotenberg' }
    ]) });
    expect((await service.plan('/tmp')).kind).toBe('reuse');
  });
  it('preserves ordinary startup when neither dependency exists', async () => {
    const service = new SharedDependencyRecovery({ exec: fake([]) });
    expect((await service.plan('/tmp')).kind).toBe('normal');
  });
  it('blocks partial ownership rather than recreating shared containers', async () => {
    const service = new SharedDependencyRecovery({ exec: fake([
      { name: 'feedback_plugin_db_local', state: 'healthy', service: 'db' }
    ]) });
    expect((await service.plan('/tmp')).kind).toBe('block');
  });
  it('blocks a colliding container name belonging to a different service', async () => {
    const service = new SharedDependencyRecovery({ exec: fake([
      { name: 'feedback_plugin_db_local', state: 'healthy', service: 'other' }
    ]) });
    expect((await service.plan('/tmp')).kind).toBe('block');
  });
});
