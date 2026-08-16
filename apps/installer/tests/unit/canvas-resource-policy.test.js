import { describe, expect, it, vi } from 'vitest';

import { getCanvasResourceLimits } from '../../src/installation/installers/CanvasResourcePolicy.js';
import { AssetBuilder } from '../../src/installation/installers/AssetBuilder.js';
import { LinuxContainerWorkspacePermissions } from '../../src/platform/linux/LinuxContainerWorkspacePermissions.js';

const GIB = 1024 ** 3;

describe('CanvasResourcePolicy', () => {
  it('keeps Canvas within an 8GB host', () => {
    expect(getCanvasResourceLimits(7.76 * GIB)).toMatchObject({ web: '4G', jobs: '1G' });
  });

  it('scales conservatively when there is enough memory', () => {
    expect(getCanvasResourceLimits(8 * GIB)).toMatchObject({ web: '5G', jobs: '2G' });
    expect(getCanvasResourceLimits(12 * GIB)).toMatchObject({ web: '8G', jobs: '2G' });
  });

  it('uses safe limits if Docker does not report memory', () => {
    expect(getCanvasResourceLimits(Number.NaN)).toMatchObject({ web: '3G', jobs: '1G' });
  });

  it('queries Docker before preparing the Canvas override', async () => {
    const runner = vi.fn().mockResolvedValue({ success: true, out: String(7.76 * GIB), err: '' });
    const boot = { info: vi.fn(), warn: vi.fn() };
    const builder = new AssetBuilder(boot, null, '/canvas', { runner });

    await expect(builder._getResourceLimits()).resolves.toMatchObject({ web: '4G', jobs: '1G' });
    expect(runner).toHaveBeenCalledWith('docker', ['info', '--format', '{{.MemTotal}}'], { captureAll: true });
  });

  it('normalizes the gems cache before installing Ruby', () => {
    const builder = new AssetBuilder({ info: vi.fn(), warn: vi.fn() }, null, '/canvas');
    const steps = builder._buildSteps();
    const permissionStep = steps.find(([command]) => command.includes('/home/docker/.gem'));
    const rubyStep = steps.find(([command]) => command.includes('BUNDLE_FROZEN=false'));

    expect(permissionStep[0]).toEqual([
      'docker', 'compose', 'exec', '-T', 'web', 'chmod', '-R', 'go-w', '/home/docker/.gem'
    ]);
    expect(rubyStep[0]).toEqual([
      'docker', 'compose', 'exec', '-T', '-e', 'BUNDLE_FROZEN=false', 'web',
      'bundle', 'install', '--jobs=2'
    ]);
    expect(steps.indexOf(permissionStep)).toBeLessThan(steps.indexOf(rubyStep));
  });

  it('migrates Canvas before Yarn and does not start workers during asset building', () => {
    const builder = new AssetBuilder({ info: vi.fn(), warn: vi.fn() }, null, '/canvas');
    const steps = builder._buildSteps();
    const migration = steps.find(([command]) => command.includes('db:create'));
    const yarn = steps.find(([command]) => command.includes('yarn') && command.includes('install'));
    const startup = steps.find(([command]) => command.slice(0, 4).join(' ') === 'docker compose up -d');

    expect(steps.indexOf(migration)).toBeLessThan(steps.indexOf(yarn));
    expect(startup[0]).toEqual(['docker', 'compose', 'up', '-d', 'postgres', 'redis', 'web']);
    expect(startup[0]).not.toContain('jobs');
  });

  it('executes assets with internal root to write the Linux rootless checkout', async () => {
    const runner = vi.fn(async () => ({ success: true, out: '', err: '' }));
    const permissions = new LinuxContainerWorkspacePermissions({ runner });
    const boot = { warn: vi.fn(), error: vi.fn() };

    await expect(permissions.prepare({ canvasDir: '/canvas', logFile: null, boot }))
      .resolves.toEqual([
        '--user', 'root', '-e', 'HOME=/tmp', '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'
      ]);
    expect(runner).toHaveBeenCalledWith('docker', [
      'compose', 'exec', '-T', '--user', 'root', 'web', 'chmod', 'o+x', '/home/docker'
    ], { cwd: '/canvas', logFile: null });

    const builder = new AssetBuilder(boot, null, '/canvas');
    builder.containerExecArgs = [
      '--user', 'root', '-e', 'HOME=/tmp', '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'
    ];
    expect(builder._applyContainerUser(['docker', 'compose', 'exec', '-T', 'web', 'bundle']))
      .toEqual([
        'docker', 'compose', 'exec', '-T', '--user', 'root', '-e', 'HOME=/tmp',
        '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin', 'web', 'bundle'
      ]);
    expect(builder._applyContainerUser([
      'docker', 'compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock'
    ])).toEqual(['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock']);
  });
});
