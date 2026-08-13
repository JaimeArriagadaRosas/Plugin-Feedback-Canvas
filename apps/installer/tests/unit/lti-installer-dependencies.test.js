import { afterEach, describe, expect, it, vi } from 'vitest';

import { DockerLtiConfigurator } from '../../src/local/DockerLtiConfigurator.js';
import { LtiInstaller } from '../../src/local/LtiInstaller.js';

const spinner = { update: vi.fn() };

afterEach(() => vi.restoreAllMocks());

describe('LtiInstaller.ensureCanvasDependencies', () => {
  it('no reinstala dependencias cuando Bundle ya está listo', async () => {
    const command = vi.spyOn(DockerLtiConfigurator, 'runDockerCommand')
      .mockResolvedValue({ success: true });

    await expect(LtiInstaller.ensureCanvasDependencies(spinner)).resolves.toBeUndefined();

    expect(command).toHaveBeenCalledTimes(1);
  });

  it('propaga un fallo al reparar Bundle en lugar de ignorarlo', async () => {
    vi.spyOn(DockerLtiConfigurator, 'runDockerCommand')
      .mockResolvedValueOnce({ success: false, err: 'missing' })
      .mockResolvedValueOnce({ success: false, err: 'plugin denied' });

    await expect(LtiInstaller.ensureCanvasDependencies(spinner)).rejects.toThrow('plugin denied');
  });
});
