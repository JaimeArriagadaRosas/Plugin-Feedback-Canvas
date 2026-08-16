import { describe, expect, it, vi } from 'vitest';

import { CanvasBringup } from '../../src/installation/CanvasBringup.js';

vi.mock('execa', () => ({
  execa: vi.fn().mockReturnValue({
    stdout: { on: vi.fn(), removeAllListeners: vi.fn() },
    kill: vi.fn(),
    removeAllListeners: vi.fn()
  })
}));

vi.mock('../../src/platform/shared/ContainerExecutionPolicy.js', () => ({
  ContainerExecutionPolicy: vi.fn().mockImplementation(() => ({
    getExecutionArgs: vi.fn().mockReturnValue(['--user', 'root', '-e', 'HOME=/tmp', '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'])
  }))
}));

function createBoot() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    action: vi.fn(),
    debug: vi.fn()
  };
}

const workspaceArgs = [
  '--user', 'root', '-e', 'HOME=/tmp', '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'
];

describe('CanvasBringup', () => {
  it('prepara permisos Linux y confirma la disponibilidad por HTTP', async () => {
    const boot = createBoot();
    const runner = vi.fn(async (_command, args) => {
      if (args.slice(0, 3).join(' ') === 'compose up -d') return { success: true, err: '' };
      if (args.includes('bundle') && args.includes('check')) return { success: true, err: '' };
      if (args.slice(0, 4).join(' ') === 'compose ps --format json') {
        return { success: true, out: '{"State":"running"}' };
      }
      throw new Error(`Comando inesperado: ${args.join(' ')}`);
    });
    const healthCheck = vi.fn().mockResolvedValue(true);
    const bringup = new CanvasBringup(boot, '/canvas', {
      runner,
      healthCheck
    });

    await expect(bringup.bringup()).resolves.toBe(true);

    expect(runner).toHaveBeenCalledWith('docker', [
      'compose', 'exec', '-T', ...workspaceArgs, 'web', 'bundle', 'check'
    ], { cwd: '/canvas' });
    expect(healthCheck).toHaveBeenCalledWith('http://localhost:8080');
  });

  it('reinstala gems con el contexto correcto y reinicia web y jobs', async () => {
    const boot = createBoot();
    const runner = vi.fn(async (_command, args) => {
      if (args.includes('bundle') && args.includes('check')) return { success: false, err: 'missing' };
      if (args.includes('plugin')) return { success: true, err: '' };
      if (args.includes('install')) return { success: true, out: '', err: '' };
      if (args.slice(0, 2).join(' ') === 'compose restart') return { success: true, err: '' };
      throw new Error(`Comando inesperado: ${args.join(' ')}`);
    });
    const bringup = new CanvasBringup(boot, '/canvas', { runner });
    bringup.containerExecArgs = workspaceArgs;

    await expect(bringup.ensureRubyDependencies()).resolves.toBe(true);

    expect(runner).toHaveBeenCalledWith('docker', [
      'compose', 'exec', '-T', ...workspaceArgs, '-e', 'BUNDLE_FROZEN=false', 'web',
      'bundle', 'install', '--jobs=2'
    ], { cwd: '/canvas' });
    expect(runner).toHaveBeenCalledWith('docker', ['compose', 'restart', 'web', 'jobs'], {
      cwd: '/canvas'
    });
  });

  it('no considera listo a Canvas hasta obtener respuesta HTTP', async () => {
    const boot = createBoot();
    const runner = vi.fn().mockResolvedValue({ success: true, out: '{"State":"running"}' });
    const healthCheck = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const sleep = vi.fn().mockResolvedValue();
    const bringup = new CanvasBringup(boot, '/canvas', { runner, healthCheck, sleep });

    await expect(bringup.waitForReady(10, 5)).resolves.toBe(true);

    expect(healthCheck).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(5000);
  });
});
