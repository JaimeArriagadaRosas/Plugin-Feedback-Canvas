import { describe, expect, it } from 'vitest';

import { assertTlsProxyConfiguration, startTlsProxy } from '../../src/local/TlsProxyServer.js';

describe('startTlsProxy', () => {
  it('rechaza antes de abrir un puerto si faltan certificados', async () => {
    expect(() => assertTlsProxyConfiguration()).toThrow(/Certificados mkcert no encontrados/);
    await expect(startTlsProxy()).rejects.toThrow(/Certificados mkcert no encontrados/);
  });
});
