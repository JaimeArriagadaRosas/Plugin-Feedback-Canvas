import { describe, expect, it, vi } from 'vitest';

import { getCanvasResourceLimits } from '../../src/installation/installers/CanvasResourcePolicy.js';
import { AssetBuilder } from '../../src/installation/installers/AssetBuilder.js';

const GIB = 1024 ** 3;

describe('CanvasResourcePolicy', () => {
  it('mantiene Canvas dentro de un host de 8GB', () => {
    expect(getCanvasResourceLimits(7.76 * GIB)).toMatchObject({ web: '4G', jobs: '1G' });
  });

  it('escala de forma conservadora cuando hay memoria suficiente', () => {
    expect(getCanvasResourceLimits(8 * GIB)).toMatchObject({ web: '5G', jobs: '2G' });
    expect(getCanvasResourceLimits(12 * GIB)).toMatchObject({ web: '8G', jobs: '2G' });
  });

  it('usa límites seguros si Docker no reporta memoria', () => {
    expect(getCanvasResourceLimits(Number.NaN)).toMatchObject({ web: '3G', jobs: '1G' });
  });

  it('consulta Docker antes de preparar el override de Canvas', async () => {
    const runner = vi.fn().mockResolvedValue({ success: true, out: String(7.76 * GIB), err: '' });
    const boot = { info: vi.fn(), warn: vi.fn() };
    const builder = new AssetBuilder(boot, null, '/canvas', { runner });

    await expect(builder._getResourceLimits()).resolves.toMatchObject({ web: '4G', jobs: '1G' });
    expect(runner).toHaveBeenCalledWith('docker', ['info', '--format', '{{.MemTotal}}'], { captureAll: true });
  });

  it('normaliza el cache de gems antes de instalar Ruby', () => {
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

  it('migra Canvas antes de Yarn y no inicia workers durante el armado de assets', () => {
    const builder = new AssetBuilder({ info: vi.fn(), warn: vi.fn() }, null, '/canvas');
    const steps = builder._buildSteps();
    const migration = steps.find(([command]) => command.includes('db:create'));
    const yarn = steps.find(([command]) => command.includes('yarn') && command.includes('install'));
    const startup = steps.find(([command]) => command.slice(0, 4).join(' ') === 'docker compose up -d');

    expect(steps.indexOf(migration)).toBeLessThan(steps.indexOf(yarn));
    expect(startup[0]).toEqual(['docker', 'compose', 'up', '-d', 'postgres', 'redis', 'web']);
    expect(startup[0]).not.toContain('jobs');
  });

});
