import { describe, expect, it, vi } from 'vitest';

import { WslCertificateToolInstaller } from '../../src/platform/linux/WslCertificateToolInstaller.js';
import { WindowsCertificateToolInstaller } from '../../src/platform/windows/WindowsCertificateToolInstaller.js';
import { createCertificateToolInstaller } from '../../src/platform/shared/CertificateToolInstallerFactory.js';

function createDependencies(environment = {}) {
  return {
    boot: { action: vi.fn(), error: vi.fn(), info: vi.fn() },
    confirm: vi.fn(),
    environment,
    interactiveRunner: vi.fn(),
    runner: vi.fn()
  };
}

describe('createCertificateToolInstaller', () => {
  it('uses the WSL adapter when Linux exposes a WSL distribution', () => {
    const installer = createCertificateToolInstaller('linux', createDependencies({ WSL_DISTRO_NAME: 'Ubuntu' }));

    expect(installer).toBeInstanceOf(WslCertificateToolInstaller);
  });

  it('uses the native Windows adapter', () => {
    const installer = createCertificateToolInstaller('win32', createDependencies());

    expect(installer).toBeInstanceOf(WindowsCertificateToolInstaller);
  });
});
