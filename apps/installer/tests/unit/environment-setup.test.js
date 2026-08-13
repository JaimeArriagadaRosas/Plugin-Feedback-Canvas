import { describe, expect, it, vi } from 'vitest';

import { EnvironmentSetup } from '../../src/installation/EnvironmentSetup.js';

function createBootLog() {
  const methods = {};
  return new Proxy(methods, {
    get(target, level) {
      if (!target[level]) target[level] = vi.fn();
      return target[level];
    }
  });
}

describe('EnvironmentSetup', () => {
  it('re-probes Compose instead of reusing the preflight state', async () => {
    const boot = createBootLog();
    const freshState = { composeAvailable: true };
    const installer = { getRuntimeState: vi.fn().mockResolvedValue(freshState) };
    const setup = new EnvironmentSetup(boot, '/plugin', '/canvas', {
      dockerInstallerFactory: vi.fn(() => installer)
    });
    const missing = {
      missing_compose: true,
      docker_state: { composeAvailable: false }
    };

    await expect(setup._ensureCompose(missing)).resolves.toBeUndefined();

    expect(installer.getRuntimeState).toHaveBeenCalledOnce();
    expect(missing).toMatchObject({ missing_compose: false, docker_state: freshState });
    expect(boot.success).toHaveBeenCalledWith('Docker Compose V2 disponible.');
    expect(boot.error).not.toHaveBeenCalled();
  });

  it('keeps the Compose failure when the fresh probe still fails', async () => {
    const boot = createBootLog();
    const freshState = { composeAvailable: false };
    const installer = {
      getRuntimeState: vi.fn().mockResolvedValue(freshState),
      policy: { compose: vi.fn().mockReturnValue('Install Compose V2.') }
    };
    const setup = new EnvironmentSetup(boot, '/plugin', '/canvas', {
      dockerInstallerFactory: vi.fn(() => installer)
    });

    await expect(setup._ensureCompose({ missing_compose: true })).rejects.toThrow(/Compose V2/);

    expect(boot.error).toHaveBeenCalledOnce();
    expect(boot.action).toHaveBeenCalledWith('Install Compose V2.');
  });
});
