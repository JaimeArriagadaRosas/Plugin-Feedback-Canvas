import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/security/SSLService.js', () => ({
  SSLService: { initializeSSLContext: vi.fn().mockResolvedValue({ env: {} }) }
}));
vi.mock('../../src/security/envGuard.js', () => ({
  getSslCertPaths: vi.fn().mockReturnValue({ cert: '/missing/cert.pem', key: '/missing/key.pem' }),
  isHttpsEnabled: vi.fn().mockReturnValue(false)
}));

import { createServerInstance } from '../../src/services/server/tlsSetup.js';

describe('createServerInstance', () => {
  it('creates a Node HTTP server when TLS is not enabled', async () => {
    const server = await createServerInstance((_request, response) => response.end('ok'));

    expect(typeof server.listen).toBe('function');
    expect(typeof server.setTimeout).toBe('function');

    await new Promise((resolve) => server.close(resolve));
  });
});
