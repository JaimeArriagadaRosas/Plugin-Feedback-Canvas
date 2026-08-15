import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/installation/utils/TokenManager.js', () => ({
  pingCanvasAPI: vi.fn().mockResolvedValue({ ready: true })
}));

import { PostflightSetup } from '../../src/installation/PostflightSetup.js';

function createBoot() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  };
}

describe('PostflightSetup', () => {
  it('synchronizes the token through the public interface when the data already exists', async () => {
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
