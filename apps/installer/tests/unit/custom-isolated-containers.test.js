import { describe, expect, it } from 'vitest';
import { SharedDependencyRecovery } from '../../src/recovery/SharedDependencyRecovery.js';

const environment = {
  PLUGIN_DB_CONTAINER_NAME: 'qa_feedback_db_20261110',
  PLUGIN_GOTENBERG_CONTAINER_NAME: 'qa_feedback_gotenberg_20261110',
  DB_PORT: '55432', GOTENBERG_PORT: '53001'
};
const response = name => {
  const db = name === environment.PLUGIN_DB_CONTAINER_NAME;
  return {
    Config: {
      Labels: { 'com.docker.compose.project': 'isolated-qa', 'com.docker.compose.service': db ? 'db' : 'gotenberg' },
      Image: db ? 'postgres:15-alpine' : 'gotenberg/gotenberg:8',
      Env: db ? ['POSTGRES_USER=postgres', 'POSTGRES_DB=feedback_plugin_db', 'POSTGRES_PASSWORD=CHANGE_ME_db_password_strong'] : []
    },
    State: { Running: true, Health: { Status: 'healthy' } },
    Mounts: db ? [{ Type: 'volume', Destination: '/var/lib/postgresql/data' }] : [],
    NetworkSettings: { Ports: db ? { '5432/tcp': [{ HostPort: '55432' }] } : { '3000/tcp': [{ HostPort: '53001' }] } }
  };
};
describe('QA: independent stacks on shared workstation', () => {
  it('recognizes only the configured containers and ports', async () => {
    const calls = [];
    const exec = async (_command, args) => {
      calls.push(args[1]);
      return { stdout: JSON.stringify(response(args[1])) };
    };
    const result = await new SharedDependencyRecovery({ exec, environment }).plan('/tmp');
    expect(result.kind).toBe('reuse');
    expect(calls).toEqual([environment.PLUGIN_DB_CONTAINER_NAME, environment.PLUGIN_GOTENBERG_CONTAINER_NAME]);
  });
  it('does not accept a container that points to the wrong exposed port', async () => {
    const exec = async (_, args) => ({ stdout: JSON.stringify({ ...response(args[1]), NetworkSettings: { Ports: {} } }) });
    const result = await new SharedDependencyRecovery({ exec, environment }).plan('/tmp');
    expect(result.kind).toBe('block');
  });
  it('rejects unsafe custom names before any Docker call', async () => {
    let calls = 0;
    const run = async () => { calls++; throw new Error('should not be called'); };
    const recovery = new SharedDependencyRecovery({ exec: run, environment: { ...environment, PLUGIN_DB_CONTAINER_NAME: 'foo;rm' } });
    await expect(recovery.plan('/tmp')).rejects.toThrow(/Invalid container name/);
    expect(calls).toBe(0);
  });
});
