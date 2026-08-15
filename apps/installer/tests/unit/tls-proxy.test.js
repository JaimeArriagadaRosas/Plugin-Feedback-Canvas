import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const existsSync = vi.fn().mockReturnValue(false);
  return {
    ...actual,
    default: { ...actual.default, existsSync },
    existsSync
  };
});

import { assertTlsProxyConfiguration, startTlsProxy } from '../../src/local/TlsProxyServer.js';

describe('startTlsProxy', () => {
  it('rejects before opening a port if certificates are missing', async () => {
    expect(() => assertTlsProxyConfiguration()).toThrow(/Certificados mkcert no encontrados/);
    await expect(startTlsProxy()).rejects.toThrow(/Certificados mkcert no encontrados/);
  });
});
