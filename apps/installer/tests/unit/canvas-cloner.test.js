import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CanvasCloner } from '../../src/installation/installers/CanvasCloner.js';

const temporaryDirectories = [];

function createTempDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-cloner-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createBoot() {
  return new Proxy({}, { get: () => vi.fn() });
}

afterEach(() => {
  while (temporaryDirectories.length) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

describe('CanvasCloner', () => {
  it('preserves a partial clone and does not treat it as a successful installation', async () => {
    const parent = createTempDirectory();
    const canvasDir = path.join(parent, 'canvas-lms-master');
    const archiveInstaller = { downloadAndExtract: vi.fn() };
    const runner = vi.fn(async (_command, args) => {
      if (args[0] === '--version') return { success: true, out: 'git', err: '' };
      fs.mkdirSync(canvasDir);
      return { success: false, out: '', err: 'network failed' };
    });

    const result = await new CanvasCloner(createBoot(), null, canvasDir, {
      runner, archiveInstaller, platform: 'linux'
    }).cloneCanvas();

    expect(result).toBe(false);
    expect(fs.existsSync(canvasDir)).toBe(true);
    expect(archiveInstaller.downloadAndExtract).not.toHaveBeenCalled();
  });

  it('uses the injected archive installer when git fails without leaving a partial destination', async () => {
    const parent = createTempDirectory();
    const canvasDir = path.join(parent, 'canvas-lms-master');
    const archiveInstaller = {
      downloadAndExtract: vi.fn(async () => {
        fs.mkdirSync(path.join(parent, 'canvas-lms-release-2026-05-20.143'));
        return true;
      })
    };
    const runner = vi.fn(async (_command, args) => ({
      success: args[0] === '--version' || args[0] === 'compose', out: '', err: 'git failed'
    }));

    const result = await new CanvasCloner(createBoot(), null, canvasDir, {
      runner, archiveInstaller, platform: 'linux'
    }).cloneCanvas();

    expect(result).toBe(true);
    expect(archiveInstaller.downloadAndExtract).toHaveBeenCalledOnce();
    expect(fs.existsSync(path.join(canvasDir, '.env'))).toBe(true);
  });

  it('does not mix a previous extraction with a new ZIP fallback', async () => {
    const parent = createTempDirectory();
    const canvasDir = path.join(parent, 'canvas-lms-master');
    fs.mkdirSync(path.join(parent, 'canvas-lms-release-2026-05-20.143'));
    const archiveInstaller = { downloadAndExtract: vi.fn() };
    const runner = vi.fn(async (_command, args) => ({
      success: args[0] === '--version', out: '', err: 'git failed'
    }));

    const result = await new CanvasCloner(createBoot(), null, canvasDir, {
      runner, archiveInstaller, platform: 'linux'
    }).cloneCanvas();

    expect(result).toBe(false);
    expect(archiveInstaller.downloadAndExtract).not.toHaveBeenCalled();
  });
});
