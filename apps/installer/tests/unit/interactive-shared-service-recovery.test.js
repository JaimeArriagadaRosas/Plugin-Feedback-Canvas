import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { SharedDependencyRecovery } from '../../src/recovery/SharedDependencyRecovery.js';
import { modeWasSelectedInteractively } from '../../src/orchestration/recoveryInteraction.js';

const cwd = '/tmp/qa-owned-recovery';
const project = 'qa-owned-recovery';
const configFile = 'docker-compose.db.yml';
const DB = 'feedback_plugin_db_local';
const G = 'feedback_plugin_gotenberg_local';

function laboratory({ db = 'healthy', gotenberg = 'healthy', owner = project,
  dbImage = 'postgres:15-alpine', dbPort = '5432', dbPassword = 'secret',
  volumeName = project + '_plugin_db_data', composeName = project,
  composeFileLabel = path.join(cwd, configFile), workDirLabel = cwd,
  failStart = false, onConfirm = null } = {}) {
  const calls = [];
  const states = { [DB]: db, [G]: gotenberg };
  const metadata = name => {
    const database = name === DB;
    const state = states[name];
    const port = database ? '5432/tcp' : '3000/tcp';
    const published = database ? dbPort : '3001';
    return {
      Config: {
        Labels: {
          'com.docker.compose.project': owner,
          'com.docker.compose.service': database ? 'db' : 'gotenberg',
          'com.docker.compose.project.working_dir': workDirLabel,
          'com.docker.compose.project.config_files': composeFileLabel
        },
        Image: database ? dbImage : 'gotenberg/gotenberg:8',
        Env: database ? [
          'POSTGRES_USER=postgres', 'POSTGRES_DB=feedback_plugin_db',
          'POSTGRES_PASSWORD=' + dbPassword
        ] : []
      },
      State: { Running: state !== 'stopped', Health: { Status: state } },
      HostConfig: { PortBindings: { [port]: [{ HostPort: published }] } },
      NetworkSettings: { Ports: state === 'stopped' ? {} : { [port]: [{ HostPort: published }] } },
      Mounts: database ? [{
        Type: 'volume', Name: volumeName, Destination: '/var/lib/postgresql/data'
      }] : []
    };
  };
  const compose = {
    name: composeName,
    services: {
      db: { image: 'postgres:15-alpine', container_name: DB,
        volumes: [{ source: 'plugin_db_data', target: '/var/lib/postgresql/data' }] },
      gotenberg: { image: 'gotenberg/gotenberg:8', container_name: G }
    },
    volumes: { plugin_db_data: { name: project + '_plugin_db_data' } }
  };
  const exec = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (args[0] === 'inspect') return { stdout: JSON.stringify(metadata(args[1])) };
    if (args[0] === 'compose') return { stdout: JSON.stringify(compose) };
    if (args[0] === 'start') {
      if (failStart) throw new Error('test Docker start failure');
      states[args[1]] = 'healthy';
      return { stdout: args[1] };
    }
    throw Error('Unexpected Docker action');
  };
  const environment = {
    DB_USER: 'postgres', DB_NAME: 'feedback_plugin_db', DB_PASSWORD: 'secret',
    DB_PORT: '5432', GOTENBERG_PORT: '3001'
  };
  const recovery = new SharedDependencyRecovery({ exec, environment, composeFile: configFile });
  const confirm = vi.fn(async (...args) => {
    if (onConfirm) await onConfirm(states);
    return true;
  });
  return { recovery, calls, states, confirm };
}

const options = { maxPolls: 2, intervalMs: 0, wait: async () => {} };
const started = x => x.calls.filter(c => c[1] === 'start').map(c => c[2]);
const forbidden = x => x.calls.filter(c => ['rm', 'stop', 'down', 'volume'].includes(c[1]));

describe('Main startup and recovery consent matrix — no menu changes', () => {
  it('TEST 1: healthy normal flow reuses both containers without prompt or modifications', async () => {
    const lab = laboratory();
    expect((await lab.recovery.plan(cwd)).kind).toBe('reuse');
    expect(started(lab)).toEqual([]);
    expect(forbidden(lab)).toEqual([]);
    expect(lab.confirm).not.toHaveBeenCalled();
  });

  it('TEST 2: one stopped owned container is confirmed, started and healthy', async () => {
    const lab = laboratory({ db: 'stopped' });
    const result = await lab.recovery.recoverWithConsent(cwd, { confirm: lab.confirm, ...options });
    expect(result.kind).toBe('reuse');
    expect(result.recovered).toEqual([DB]);
    expect(started(lab)).toEqual([DB]);
    expect(lab.confirm).toHaveBeenCalledOnce();
    expect(lab.confirm.mock.calls[0][1]).toBe(false); // answer defaults to NO
    expect(result.services.every(s => s.state === 'healthy')).toBe(true);
    expect(forbidden(lab)).toEqual([]);
  });

  it('TEST 3: two stopped containers with no special .env flags recover after consent', async () => {
    const lab = laboratory({ db: 'stopped', gotenberg: 'stopped' });
    const original = await lab.recovery.plan(cwd);
    expect(original.kind).toBe('block');
    expect(original.reason).toMatch(/Partial|stopped/);
    const result = await lab.recovery.recoverWithConsent(cwd, { confirm: lab.confirm, ...options });
    expect(result.kind).toBe('reuse');
    expect(started(lab)).toEqual([DB, G]);
    expect(result.recovered).toEqual([DB, G]);
    expect(result.services.map(s => s.state)).toEqual(['healthy', 'healthy']);
    expect(forbidden(lab)).toEqual([]);
  });

  it('denial never starts a container', async () => {
    const lab = laboratory({ db: 'stopped', gotenberg: 'stopped' });
    const result = await lab.recovery.recoverWithConsent(cwd, {
      confirm: async () => false, ...options
    });
    expect(result.kind).toBe('block');
    expect(started(lab)).toEqual([]);
  });

  it('noninteractive automation cannot silently approve recovery', async () => {
    const lab = laboratory({ db: 'stopped' });
    lab.recovery.environment.NON_INTERACTIVE = 'true';
    expect((await lab.recovery.recoverWithConsent(cwd, { confirm: lab.confirm })).kind).toBe('block');
    expect(lab.confirm).not.toHaveBeenCalled();
    expect(started(lab)).toEqual([]);
  });

  it.each([
    ['foreign Compose project', { owner: 'another-project' }],
    ['wrong image', { dbImage: 'postgres:16' }],
    ['wrong port', { dbPort: '1234' }],
    ['wrong db credentials', { dbPassword: 'wrong' }],
    ['wrong volume', { volumeName: 'other_db_data' }],
    ['wrong Compose source', { composeFileLabel: '/other/project/docker-compose.db.yml' }],
    ['wrong work directory', { workDirLabel: '/other/project' }],
    ['incorrect effective project', { composeName: 'other-project' }],
    ['unhealthy running database', { db: 'unhealthy' }]
  ])('rejects %s before prompting or starting', async (_, attrs) => {
    const lab = laboratory({ db: 'stopped', ...attrs });
    const outcome = await lab.recovery.recoverWithConsent(cwd, { confirm: lab.confirm });
    expect(outcome.kind).toBe('block');
    expect(started(lab)).toEqual([]);
    expect(lab.confirm).not.toHaveBeenCalled();
  });

  it('refuses to act if status changes between consent and the second inspection', async () => {
    const lab = laboratory({ db: 'stopped', onConfirm: states => { states[DB] = 'healthy'; } });
    const outcome = await lab.recovery.recoverWithConsent(cwd, { confirm: lab.confirm, ...options });
    expect(outcome.kind).toBe('block');
    expect(started(lab)).toEqual([]);
  });

  it('never starts if Docker compose config cannot be read', async () => {
    const lab = laboratory({ db: 'stopped' });
    const exec = lab.recovery.exec;
    lab.recovery.exec = async (cmd, args) => {
      if (args[0] === 'compose') throw Error('compose config unavailable');
      return exec(cmd, args);
    };
    const result = await lab.recovery.recoverWithConsent(cwd, { confirm: lab.confirm });
    expect(result.kind).toBe('block');
    expect(started(lab)).toEqual([]);
  });
});

describe('Interactive menu provenance survives internal NON_INTERACTIVE=true', () => {
  it('detects real manual mode selection before internal mode switch', () => {
    expect(modeWasSelectedInteractively({requestedMode:undefined,
      nonInteractive:undefined,stdinIsTTY:true})).toBe(true);
    expect(modeWasSelectedInteractively({requestedMode:undefined,
      nonInteractive:'false',stdinIsTTY:true})).toBe(true);
    expect(modeWasSelectedInteractively({requestedMode:'3',
      nonInteractive:undefined,stdinIsTTY:true})).toBe(false);
    expect(modeWasSelectedInteractively({requestedMode:undefined,
      nonInteractive:'true',stdinIsTTY:true})).toBe(false);
    expect(modeWasSelectedInteractively({requestedMode:undefined,
      nonInteractive:undefined,stdinIsTTY:false})).toBe(false);
  });

  async function withTTY(isTTY,callback) {
    const former=Object.getOwnPropertyDescriptor(process.stdin,'isTTY');
    Object.defineProperty(process.stdin,'isTTY',{configurable:true,value:isTTY});
    try { return await callback(); }
    finally {
      if(former)Object.defineProperty(process.stdin,'isTTY',former);
      else delete process.stdin.isTTY;
    }
  }

  it('regression: interactive mode 3 still prompts after main sets NON_INTERACTIVE=true', async () => {
    await withTTY(true,async()=>{
      const lab=laboratory({db:'stopped',gotenberg:'stopped'});
      lab.recovery.environment.NON_INTERACTIVE='true';
      lab.recovery.environment.PLUGIN_RECOVERY_MENU_INTERACTIVE='true';
      const result=await lab.recovery.recoverWithConsent(cwd,{confirm:lab.confirm,...options});
      expect(result.kind).toBe('reuse');
      expect(lab.confirm).toHaveBeenCalledOnce();
      expect(started(lab)).toEqual([DB,G]);
    });
  });

  it('unattended startup cannot spoof interactive consent without TTY', async () => {
    await withTTY(false,async()=>{
      const lab=laboratory({db:'stopped',gotenberg:'stopped'});
      lab.recovery.environment.NON_INTERACTIVE='true';
      lab.recovery.environment.PLUGIN_RECOVERY_MENU_INTERACTIVE='true';
      const result=await lab.recovery.recoverWithConsent(cwd,{confirm:lab.confirm,...options});
      expect(result.kind).toBe('block');
      expect(started(lab)).toEqual([]);
      expect(lab.confirm).not.toHaveBeenCalled();
    });
  });

  it('internally noninteractive startup without menu provenance still refuses prompt', async () => {
    await withTTY(true,async()=>{
      const lab=laboratory({db:'stopped',gotenberg:'stopped'});
      lab.recovery.environment.NON_INTERACTIVE='true';
      lab.recovery.environment.PLUGIN_RECOVERY_MENU_INTERACTIVE='false';
      const result=await lab.recovery.recoverWithConsent(cwd,{confirm:lab.confirm,...options});
      expect(result.kind).toBe('block');
      expect(started(lab)).toEqual([]);
      expect(lab.confirm).not.toHaveBeenCalled();
    });
  });
});
