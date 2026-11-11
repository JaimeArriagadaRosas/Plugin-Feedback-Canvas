import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentSetup } from '../../src/installation/EnvironmentSetup.js';

const created = [];
const originalFastBoot = process.env.FAST_BOOT;

function fixture({ canvasExists = false } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-compat-interrupted-'));
  created.push(temp);
  const pluginDir = path.join(temp, 'plugin');
  const canvasDir = path.join(temp, 'canvas');
  fs.mkdirSync(pluginDir);
  if (canvasExists) fs.mkdirSync(canvasDir);
  const marker = path.join(pluginDir, '.setup_complete');
  fs.writeFileSync(marker, '1');
  const boot = { warn: vi.fn(), info: vi.fn() };
  return { boot, pluginDir, canvasDir, marker };
}

afterEach(() => {
  if (originalFastBoot === undefined) delete process.env.FAST_BOOT;
  else process.env.FAST_BOOT = originalFastBoot;
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Recuperación de setup interrumpido y protección de rutas', () => {
  it('elimina solo el marcador Fast Boot obsoleto, sin abrir Docker ni navegador', () => {
    const { boot, pluginDir, canvasDir, marker } = fixture();
    process.env.FAST_BOOT = 'true';
    new EnvironmentSetup(boot, pluginDir, canvasDir)._recoverInvalidFastBoot();
    expect(fs.existsSync(marker)).toBe(false);
    expect(process.env.FAST_BOOT).toBe('false');
    expect(boot.warn).toHaveBeenCalledOnce();
    expect(boot.info).toHaveBeenCalledOnce();
  });

  it('no elimina el marcador si la carpeta de Canvas existe', () => {
    const { boot, pluginDir, canvasDir, marker } = fixture({ canvasExists: true });
    process.env.FAST_BOOT = 'true';
    new EnvironmentSetup(boot, pluginDir, canvasDir)._recoverInvalidFastBoot();
    expect(fs.existsSync(marker)).toBe(true);
    expect(process.env.FAST_BOOT).toBe('true');
    expect(boot.warn).not.toHaveBeenCalled();
  });

  it('no modifica un entorno sin Fast Boot habilitado', () => {
    const { boot, pluginDir, canvasDir, marker } = fixture();
    process.env.FAST_BOOT = 'false';
    new EnvironmentSetup(boot, pluginDir, canvasDir)._recoverInvalidFastBoot();
    expect(fs.existsSync(marker)).toBe(true);
    expect(process.env.FAST_BOOT).toBe('false');
    expect(boot.warn).not.toHaveBeenCalled();
  });
});
