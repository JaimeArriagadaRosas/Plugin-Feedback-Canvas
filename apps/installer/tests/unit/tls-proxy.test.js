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

import { assertTlsProxyConfiguration, startTlsProxy, rewriteLocationHeader } from '../../src/local/TlsProxyServer.js';

describe('startTlsProxy', () => {
  it('rechaza antes de abrir un puerto si faltan certificados', async () => {
    expect(() => assertTlsProxyConfiguration()).toThrow(/Certificados mkcert no encontrados/);
    await expect(startTlsProxy()).rejects.toThrow(/Certificados mkcert no encontrados/);
  });
});

describe('rewriteLocationHeader', () => {
  it('local redirect http://localhost:8443 -> https://localhost:8443', () => {
    const headers = { location: 'http://localhost:8443/files/15/download?sf_verifier=123' };
    const res = rewriteLocationHeader(headers, '/api/v1/files/15');
    expect(res.location).toBe('https://localhost:8443/files/15/download?sf_verifier=123');
  });

  it('https://localhost:8443 permanece igual', () => {
    const headers = { location: 'https://localhost:8443/files/15/download' };
    const res = rewriteLocationHeader(headers, '/api/v1/files/15');
    expect(res.location).toBe('https://localhost:8443/files/15/download');
  });

  it('http://127.0.0.1:8080 redirige a https://localhost:8443 (comportamiento base esperado)', () => {
    const headers = { location: 'http://127.0.0.1:8080/login' };
    const res = rewriteLocationHeader(headers, '/login');
    expect(res.location).toBe('https://localhost:8443/login');
  });

  it('host externo no se reescribe', () => {
    const headers = { location: 'https://aws.s3.amazon.com/file?sf_verifier=123' };
    const res = rewriteLocationHeader(headers, '/api/v1/files/15');
    expect(res.location).toBe('https://aws.s3.amazon.com/file?sf_verifier=123');
  });

  it('sf_verifier/query se conserva al reescribir http://localhost:8443', () => {
    const headers = { location: 'http://localhost:8443/files/15/download?download_frd=1&sf_verifier=eyJ0' };
    const res = rewriteLocationHeader(headers, '/api/v1/files/15');
    expect(res.location).toBe('https://localhost:8443/files/15/download?download_frd=1&sf_verifier=eyJ0');
  });
});
