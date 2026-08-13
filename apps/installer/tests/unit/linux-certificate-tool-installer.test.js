import { describe, expect, it, vi } from 'vitest';

import { LinuxCertificateToolInstaller } from '../../src/platform/linux/LinuxCertificateToolInstaller.js';

function createInstaller({ available = false, confirm = true } = {}) {
  const runner = vi.fn()
    .mockResolvedValueOnce({ success: available })
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: true });
  const interactiveRunner = vi.fn().mockResolvedValue(true);
  const installer = new LinuxCertificateToolInstaller({
    boot: { action: vi.fn(), error: vi.fn(), info: vi.fn() },
    confirm: vi.fn().mockResolvedValue(confirm),
    interactiveRunner,
    runner
  });
  return { installer, interactiveRunner, runner };
}

describe('LinuxCertificateToolInstaller', () => {
  it('no solicita sudo si mkcert ya está disponible', async () => {
    const { installer, interactiveRunner } = createInstaller({ available: true });

    await expect(installer.ensureTool()).resolves.toBe(true);

    expect(interactiveRunner).not.toHaveBeenCalled();
  });

  it('solicita confirmación y ejecuta sudo apt para instalar dependencias faltantes', async () => {
    const { installer, interactiveRunner } = createInstaller();

    await expect(installer.ensureTool()).resolves.toBe(true);

    expect(interactiveRunner).toHaveBeenNthCalledWith(1, 'sudo', ['apt-get', 'update']);
    expect(interactiveRunner).toHaveBeenNthCalledWith(2, 'sudo', [
      'apt-get', 'install', '-y', 'mkcert', 'libnss3-tools'
    ]);
  });
});
