import { describe, expect, it, vi } from 'vitest';

import { LinuxCertificateToolInstaller } from '../../src/platform/linux/LinuxCertificateToolInstaller.js';

function createSpinner() {
  return {
    error: vi.fn(),
    start: vi.fn(),
    success: vi.fn(),
    update: vi.fn()
  };
}

function createInstaller({ available = false, confirm = true } = {}) {
  const runner = vi.fn()
    .mockResolvedValueOnce({ success: available })
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: true });
  const interactiveRunner = vi.fn().mockResolvedValue(true);
  const spinner = createSpinner();
  spinner.start.mockReturnValue(spinner);
  const installer = new LinuxCertificateToolInstaller({
    boot: { action: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() },
    confirm: vi.fn().mockResolvedValue(confirm),
    interactiveRunner,
    runner,
    spinnerFactory: vi.fn().mockReturnValue(spinner)
  });
  return { installer, interactiveRunner, runner, spinner };
}

describe('LinuxCertificateToolInstaller', () => {
  it('does not request sudo if mkcert is already available', async () => {
    const { installer, interactiveRunner } = createInstaller({ available: true });

    await expect(installer.ensureTool()).resolves.toBe(true);

    expect(interactiveRunner).not.toHaveBeenCalled();
  });

  it('validates sudo and runs APT with bounded output', async () => {
    const { installer, interactiveRunner, runner, spinner } = createInstaller();

    await expect(installer.ensureTool()).resolves.toBe(true);

    expect(interactiveRunner).toHaveBeenCalledWith('sudo', ['-v']);
    expect(runner).toHaveBeenNthCalledWith(3, 'sudo', ['-n', 'apt-get', 'update', '-qq']);
    expect(runner).toHaveBeenNthCalledWith(4, 'sudo', [
      '-n', 'env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '-qq',
      'mkcert', 'libnss3-tools'
    ]);
    expect(spinner.success).toHaveBeenCalledOnce();
  });
});
