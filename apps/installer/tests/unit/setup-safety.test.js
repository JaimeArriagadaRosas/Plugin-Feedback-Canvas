import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DependenciesCheck } from '../../src/orchestration/boot/checks/dependencies.js';
import { DataSeeder } from '../../src/installation/DataSeeder.js';

const temporaryDirectories = [];

function createBootLog() {
  const methods = {};
  return new Proxy(methods, {
    get(target, level) {
      if (!target[level]) target[level] = vi.fn();
      return target[level];
    }
  });
}

afterEach(() => {
  while (temporaryDirectories.length) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

describe('seguridad de setup', () => {
  it('copia semillas de Canvas sin interpolar rutas en un shell', async () => {
    const runner = vi.fn().mockResolvedValue({ success: true, err: '' });
    const seeder = new DataSeeder(createBootLog(), '/plugin path', '/canvas path', { runner });

    await expect(seeder._copySeedFiles()).resolves.toBe(true);
    expect(runner).toHaveBeenCalledWith('docker', [
      'compose', 'cp', path.join('/plugin path', 'tools', 'canvas-local', 'seeds'), 'web:/tmp/seeds'
    ], { cwd: '/canvas path' });
  });

  it('detiene el seed antes de ejecutar Rails si no puede copiar los archivos', async () => {
    const runner = vi.fn().mockResolvedValue({ success: false, err: 'copy denied' });
    const boot = createBootLog();
    const seeder = new DataSeeder(boot, '/plugin', '/canvas', { runner });

    await expect(seeder._copySeedFiles()).resolves.toBe(false);
    expect(boot.error).toHaveBeenCalledWith(expect.stringContaining('copy denied'));
  });

  it('no ejecuta npm install cuando falta Playwright', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-check-'));
    temporaryDirectories.push(directory);
    fs.writeFileSync(path.join(directory, 'package.json'), '{}');
    fs.writeFileSync(path.join(directory, 'package-lock.json'), '{}');
    const boot = createBootLog();

    const result = new DependenciesCheck(directory).run(boot);

    expect(result).toMatchObject({ ok: true, degraded: true });
    expect(result.fix).toContain('npm start');
    expect(boot.warn).toHaveBeenCalled();
  });
});
