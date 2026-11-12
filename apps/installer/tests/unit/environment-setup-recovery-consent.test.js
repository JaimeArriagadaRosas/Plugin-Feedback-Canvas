import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tests = vi.hoisted(() => ({
  plan: vi.fn(), recoverWithConsent: vi.fn(), recoverOwnedStopped: vi.fn(),
  migrate: vi.fn()
}));
vi.mock('../../src/recovery/SharedDependencyRecovery.js', () => ({
  SharedDependencyRecovery: class {
    plan() { return tests.plan(); }
    recoverWithConsent(dir, options) { return tests.recoverWithConsent(dir, options); }
    recoverOwnedStopped() { return tests.recoverOwnedStopped(); }
  }
}));
vi.mock('@plugin-feedback/plugin-database', () => ({
  runMigrations: tests.migrate
}));
import { EnvironmentSetup } from '../../src/installation/EnvironmentSetup.js';

const boot = () => ({
  info: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn()
});
const instantiate = confirm => new EnvironmentSetup(boot(), '/qa/recovery/plugin', '/qa/canvas', { confirm });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY', 'false');
  tests.plan.mockResolvedValue({kind:'block', services:[]});
  tests.recoverWithConsent.mockResolvedValue({kind:'reuse',recovered:['owned-db'],services:[]});
  tests.recoverOwnedStopped.mockResolvedValue({kind:'reuse',recovered:['owned-db'],services:[]});
  tests.migrate.mockResolvedValue();
});
afterEach(() => vi.unstubAllEnvs());

describe('Option 3 setup: healthy, stopped and previously blocked cases', () => {
  it('1 healthy: uses the usual path without Docker recovery or prompts', async () => {
    const confirm = vi.fn();
    await instantiate(confirm)._ensurePluginDatabase({});
    expect(confirm).not.toHaveBeenCalled();
    expect(tests.plan).not.toHaveBeenCalled();
    expect(tests.recoverWithConsent).not.toHaveBeenCalled();
    expect(tests.migrate).not.toHaveBeenCalled();
  });

  it('2 stopped: runs the safe confirmation path then plugin migrations once', async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    tests.recoverWithConsent.mockImplementation(async (cwd,{confirm:prompt}) => {
      expect(cwd).toBe('/qa/recovery/plugin');
      expect(prompt).toBe(confirm);
      expect(await prompt('¿Recuperar?',false)).toBe(true);
      return {kind:'reuse',recovered:['owned-db']};
    });
    await instantiate(confirm)._ensurePluginDatabase({ plugin_db_status:'stopped' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(tests.migrate).toHaveBeenCalledOnce();
    expect(tests.recoverOwnedStopped).not.toHaveBeenCalled();
  });

  it('3 both stopped: invokes the same safe path with no opt-in env', async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    await instantiate(confirm)._ensurePluginDatabase({
      plugin_db_status:'stopped',gotenberg_status:'stopped'
    });
    expect(tests.recoverWithConsent).toHaveBeenCalledOnce();
    expect(tests.migrate).toHaveBeenCalledOnce();
  });

  it('declined or unsafe recovery blocks without running migrations', async () => {
    tests.recoverWithConsent.mockResolvedValue({kind:'block',reason:'User declined'});
    await expect(instantiate(vi.fn())._ensurePluginDatabase({
      plugin_db_status:'stopped',gotenberg_status:'stopped'
    })).rejects.toThrow('Safe recovery blocked');
    expect(tests.migrate).not.toHaveBeenCalled();
  });

  it('partial restart failure reports which container was already started', async () => {
    tests.recoverWithConsent.mockResolvedValue({
      kind:'block',reason:'Gotenberg did not become healthy',recovered:['owned-db']
    });
    await expect(instantiate(vi.fn())._ensurePluginDatabase({
      plugin_db_status:'stopped', gotenberg_status:'stopped'
    })).rejects.toThrow(/Started: owned-db/);
    expect(tests.migrate).not.toHaveBeenCalled();
  });

  it('explicit environment opt-in still preserves previous authorized path', async () => {
    vi.stubEnv('PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY','true');
    vi.stubEnv('COMPOSE_PROJECT_NAME','qa-owned-test-project');
    await instantiate(vi.fn())._ensurePluginDatabase({ plugin_db_status:'stopped' });
    expect(tests.recoverOwnedStopped).toHaveBeenCalledOnce();
    expect(tests.recoverWithConsent).not.toHaveBeenCalled();
    expect(tests.migrate).toHaveBeenCalledOnce();
  });

  it('opt-in without known Compose owner still requires interactive consent', async () => {
    vi.stubEnv('PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY','true');
    vi.stubEnv('COMPOSE_PROJECT_NAME','');
    await instantiate(vi.fn())._ensurePluginDatabase({ plugin_db_status:'stopped' });
    expect(tests.recoverWithConsent).toHaveBeenCalledOnce();
    expect(tests.recoverOwnedStopped).not.toHaveBeenCalled();
  });

  it('healthy/reusable decision never prompts even if stale preflight reported missing', async () => {
    tests.plan.mockResolvedValue({kind:'reuse',services:[]});
    const confirm=vi.fn();
    await instantiate(confirm)._ensurePluginDatabase({ gotenberg_status:'unhealthy' });
    expect(confirm).not.toHaveBeenCalled();
    expect(tests.migrate).toHaveBeenCalledOnce();
  });
});
