import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostflightSetup } from '../../src/installation/PostflightSetup.js';
import { VerifyData } from '../../src/installation/VerifyData.js';
import { DataSeeder } from '../../src/installation/DataSeeder.js';
import { DatabaseHealth } from '../../src/installation/DatabaseHealth.js';
import { RubyDependencyInstaller } from '../../src/installation/installers/RubyDependencyInstaller.js';
import * as tokenManager from '../../src/installation/utils/TokenManager.js';

vi.mock('../../src/installation/VerifyData.js');
vi.mock('../../src/installation/DataSeeder.js');
vi.mock('../../src/installation/DatabaseHealth.js');
vi.mock('../../src/installation/installers/RubyDependencyInstaller.js');
vi.mock('../../src/installation/utils/TokenManager.js', () => ({
  pingCanvasAPI: vi.fn().mockResolvedValue({ ready: true })
}));

function createBoot() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  };
}

describe('PostflightSetup', () => {
  it('synchronizes the token via the public interface when the data already exists', async () => {
    const verifier = { isDataPopulated: vi.fn().mockResolvedValue(true) };
    const seeder = { synchronizeLocalToken: vi.fn().mockResolvedValue() };
    const setup = new PostflightSetup(createBoot(), '/plugin', '/canvas', {
      verifierFactory: vi.fn(() => verifier),
      seederFactory: vi.fn(() => seeder)
    });

    await expect(setup.runChecks()).resolves.toBe(true);

    expect(seeder.synchronizeLocalToken).toHaveBeenCalledOnce();
  });
});
