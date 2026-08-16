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
  it('uses the provided dockerProfile to check compose availability', async () => {
    const boot = createBootLog();
    const dockerProfile = { composeAvailable: true };
    const installer = {};
    const setup = new EnvironmentSetup(boot, '/plugin', '/canvas', {
      dockerInstallerFactory: vi.fn(() => installer)
    });
    const missing = {
      missing_compose: true
    };

    await expect(setup._ensureCompose(missing, dockerProfile)).resolves.toBeUndefined();

    expect(missing).toMatchObject({ missing_compose: false, docker_state: dockerProfile });
    expect(boot.success).toHaveBeenCalledWith('Docker Compose V2 disponible.');
    expect(boot.error).not.toHaveBeenCalled();
  });

  it('throws an error if compose is not available in the dockerProfile', async () => {
    const boot = createBootLog();
    const dockerProfile = { composeAvailable: false };
    const installer = {
      policy: { compose: vi.fn().mockReturnValue('Install Compose V2.') }
    };
    const setup = new EnvironmentSetup(boot, '/plugin', '/canvas', {
      dockerInstallerFactory: vi.fn(() => installer)
    });

    await expect(setup._ensureCompose({ missing_compose: true }, dockerProfile)).rejects.toThrow(/Compose V2/);

    expect(boot.error).toHaveBeenCalledOnce();
    expect(boot.action).toHaveBeenCalledWith('Install Compose V2.');
  });

  it('aborting fast boot sets FAST_BOOT to false', () => {
    const boot = createBootLog();
    const setup = new EnvironmentSetup(boot, '/plugin', '/canvas');
    process.env.FAST_BOOT = 'true';
    setup._recoverInvalidFastBoot();
    expect(process.env.FAST_BOOT).toBe('false');
  });
});
