import { describe, expect, it, vi } from 'vitest';

import { createCanvasArchiveInstaller } from '../../src/platform/shared/CanvasArchiveInstallerFactory.js';
import { LinuxCanvasArchiveInstaller } from '../../src/platform/linux/LinuxCanvasArchiveInstaller.js';
import { WindowsCanvasArchiveInstaller } from '../../src/platform/windows/WindowsCanvasArchiveInstaller.js';
import { WindowsGitCommandLocator } from '../../src/platform/windows/WindowsGitCommandLocator.js';

const request = {
  url: 'https://example.test/canvas.zip',
  zipFile: '/tmp/canvas.zip',
  destinationDir: '/tmp/canvas',
  logFile: '/tmp/setup.log'
};

describe('Canvas archive installers by platform', () => {
  it('uses curl and unzip exclusively on Linux', async () => {
    const runner = vi.fn().mockResolvedValue({ success: true });
    const installer = new LinuxCanvasArchiveInstaller({ runner });

    await expect(installer.downloadAndExtract(request)).resolves.toBe(true);
    expect(runner).toHaveBeenNthCalledWith(1, 'curl', [
      '--fail', '--location', '--retry', '3', '--output', request.zipFile, request.url
    ], { logFile: request.logFile });
    expect(runner).toHaveBeenNthCalledWith(2, 'unzip', [
      '-q', request.zipFile, '-d', request.destinationDir
    ], { logFile: request.logFile });
  });

  it('does not attempt to extract if Linux download fails', async () => {
    const runner = vi.fn().mockResolvedValue({ success: false });
    const installer = new LinuxCanvasArchiveInstaller({ runner });

    await expect(installer.downloadAndExtract(request)).resolves.toBe(false);
    expect(runner).toHaveBeenCalledOnce();
  });

  it('uses PowerShell with literal and escaped paths on Windows', async () => {
    const runner = vi.fn().mockResolvedValue({ success: true });
    const installer = new WindowsCanvasArchiveInstaller({ runner });

    await expect(installer.downloadAndExtract({
      ...request, zipFile: "C:\\tmp\\it's-canvas.zip"
    })).resolves.toBe(true);
    const commands = runner.mock.calls.map(([command, args]) => [command, ...args]);
    expect(commands[0][0]).toBe('powershell.exe');
    expect(commands[0].join(' ')).toContain("'C:\\tmp\\it''s-canvas.zip'");
    expect(commands[1].join(' ')).toContain('Expand-Archive -LiteralPath');
  });

  it('selects the corresponding native installer', () => {
    expect(createCanvasArchiveInstaller('win32', { runner: vi.fn() })).toBeInstanceOf(WindowsCanvasArchiveInstaller);
    expect(createCanvasArchiveInstaller('linux', { runner: vi.fn() })).toBeInstanceOf(LinuxCanvasArchiveInstaller);
  });

  it('chooses the most recent version of GitHub Desktop on Windows', () => {
    const fileSystem = {
      existsSync: vi.fn(() => true),
      readdirSync: () => ['app-3.9.0', 'app-3.10.0']
    };
    const locator = new WindowsGitCommandLocator({ fileSystem, userProfile: 'C:\\Users\\test' });

    expect(locator.find()).toContain('app-3.10.0');
  });
});
