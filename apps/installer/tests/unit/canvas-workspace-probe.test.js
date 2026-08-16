import { describe, expect, it, vi } from 'vitest';
import { CanvasWorkspaceProbe } from '../../src/installation/CanvasWorkspaceProbe.js';

function createBootLog() {
  const methods = {};
  return new Proxy(methods, {
    get(target, level) {
      if (!target[level]) target[level] = vi.fn();
      return target[level];
    }
  });
}

describe('CanvasWorkspaceProbe', () => {
  it('passes when all essential paths are writable', async () => {
    const boot = createBootLog();
    const runner = vi.fn().mockImplementation(async (cmd, args) => {
      const fullCmd = [cmd, ...args].join(' ');
      if (fullCmd.includes('id -u')) return { success: true, out: '1000\n' };
      if (fullCmd.includes('.probe')) return { success: true, out: '' };
      return { success: false, err: 'Unknown command' };
    });

    const probe = new CanvasWorkspaceProbe(boot, '/canvas', { runner });
    const result = await probe.runChecks();

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(boot.success).toHaveBeenCalledWith('Workspace verificado correctamente.');
  });

  it('detects CANVAS_TMP_PERMISSION_DENIED when /usr/src/app/tmp is not writable', async () => {
    const boot = createBootLog();
    const runner = vi.fn().mockImplementation(async (cmd, args) => {
      const fullCmd = [cmd, ...args].join(' ');
      if (fullCmd.includes('id -u')) return { success: true, out: '1000\n' };
      if (fullCmd.includes('tmp/.probe')) return { success: false, err: 'Permission denied' };
      if (fullCmd.includes('stat -c %u:%g %a /usr/src/app/tmp')) return { success: true, out: '0:0 755\n' };
      if (fullCmd.includes('.probe')) return { success: true, out: '' };
      return { success: false, err: 'Unknown command' };
    });

    const probe = new CanvasWorkspaceProbe(boot, '/canvas', { runner });
    const result = await probe.runChecks();

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('CANVAS_TMP_PERMISSION_DENIED');
    expect(result.errors[0].details).toContain('Stat: 0:0 755');
  });

  it('detects CANVAS_WORKSPACE_PERMISSION_DENIED when root is not writable', async () => {
    const boot = createBootLog();
    const runner = vi.fn().mockImplementation(async (cmd, args) => {
      const fullCmd = [cmd, ...args].join(' ');
      if (fullCmd.includes('id -u')) return { success: true, out: '1000\n' };
      if (fullCmd.includes('/usr/src/app/.probe')) return { success: false, err: 'Read-only file system' };
      if (fullCmd.includes('.probe')) return { success: true, out: '' };
      return { success: true, out: '0:0 755\n' }; // Para stat
    });

    const probe = new CanvasWorkspaceProbe(boot, '/canvas', { runner });
    const result = await probe.runChecks();

    expect(result.ok).toBe(false);
    expect(result.errors.find(e => e.type === 'CANVAS_WORKSPACE_PERMISSION_DENIED')).toBeDefined();
  });
});
