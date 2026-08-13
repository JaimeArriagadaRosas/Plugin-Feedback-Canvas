import { describe, expect, it, vi } from 'vitest';

import { Orchestrator } from '../../src/local/Orchestrator.js';

describe('Orchestrator TLS', () => {
  it('delega el prerrequisito TLS al bootstrap inyectado', async () => {
    const ensure = vi.fn().mockResolvedValue(true);
    const factory = vi.fn().mockResolvedValue({ ensure });
    const boot = { warn: vi.fn() };
    const orchestrator = new Orchestrator(boot, '/plugin', '/canvas', {
      certificateBootstrapFactory: factory
    });

    await expect(orchestrator.ensureTlsPrerequisites()).resolves.toBe(true);

    expect(factory).toHaveBeenCalledWith(boot);
    expect(ensure).toHaveBeenCalledOnce();
  });
});
