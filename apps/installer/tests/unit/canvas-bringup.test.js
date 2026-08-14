import { describe, expect, it, vi } from 'vitest';

import { CanvasBringup } from '../../src/installation/CanvasBringup.js';

vi.mock('execa', () => ({
  execa: vi.fn().mockReturnValue({
    stdout: { on: vi.fn(), removeAllListeners: vi.fn() },
    kill: vi.fn(),
    removeAllListeners: vi.fn()
  })
}));

function createBoot() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
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
      if (args.slice(0, 4).join(' ') === 'compose ps -q web') {
        return { success: true, out: 'container-id' };
      }
      throw new Error(`Comando inesperado: ${args.join(' ')}`);
    });
    const permissions = { prepare: vi.fn().mockResolvedValue(workspaceArgs) };
    const healthCheck = vi.fn().mockResolvedValue(true);
    const bringup = new CanvasBringup(boot, '/canvas', {
      runner,
      containerWorkspacePermissions: permissions,
      healthCheck
    });

    await expect(bringup.bringup()).resolves.toBe(true);

    expect(permissions.prepare).toHaveBeenCalledWith({ canvasDir: '/canvas', logFile: null, boot });
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
    const runner = vi.fn().mockResolvedValue({ success: true, out: 'container-id' });
    const healthCheck = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const sleep = vi.fn().mockResolvedValue();
    const bringup = new CanvasBringup(boot, '/canvas', { runner, healthCheck, sleep });

    await expect(bringup.waitForReady(5)).resolves.toBe(true);

    expect(healthCheck).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(boot.success).toHaveBeenCalledWith('Canvas LMS está listo para recibir solicitudes');
  });
});
