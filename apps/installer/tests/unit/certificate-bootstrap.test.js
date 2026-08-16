import { describe, expect, it, vi } from 'vitest';

import { CertificateBootstrap } from '../../src/platform/shared/CertificateBootstrap.js';

function createDependencies(certificatesReady) {
  return {
    boot: { error: vi.fn(), warn: vi.fn() },
    certificateGenerator: {
      ensureCertificates: vi.fn().mockResolvedValue(true),
      hasUsableCertificates: vi.fn().mockReturnValue(certificatesReady)
    },
    platformInstaller: {
      confirmCertificateAuthority: vi.fn().mockResolvedValue(true),
      ensureBrowserTrust: vi.fn().mockResolvedValue(true),
      ensureTool: vi.fn().mockResolvedValue(true)
    }
  };
}

describe('CertificateBootstrap', () => {
  it('skips installations and confirmations if the certificate is still valid', async () => {
    const dependencies = createDependencies(true);
    const bootstrap = new CertificateBootstrap(dependencies);

    await expect(bootstrap.ensure()).resolves.toBe(true);

    expect(dependencies.platformInstaller.ensureTool).not.toHaveBeenCalled();
    expect(dependencies.certificateGenerator.ensureCertificates).not.toHaveBeenCalled();
    expect(dependencies.platformInstaller.ensureBrowserTrust).toHaveBeenCalledOnce();
  });

  it('installs and generates certificates only when necessary', async () => {
    const dependencies = createDependencies(false);
    const bootstrap = new CertificateBootstrap(dependencies);

    await expect(bootstrap.ensure()).resolves.toBe(true);

    expect(dependencies.platformInstaller.ensureTool).toHaveBeenCalledOnce();
    expect(dependencies.platformInstaller.confirmCertificateAuthority).toHaveBeenCalledOnce();
    expect(dependencies.certificateGenerator.ensureCertificates).toHaveBeenCalledOnce();
  });
});
