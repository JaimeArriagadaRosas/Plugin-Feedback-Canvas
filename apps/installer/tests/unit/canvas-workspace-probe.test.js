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
  it('detects CANVAS_LOG_PERMISSION_DENIED when development.log is root:root 0644 and user is not root', async () => {
    const boot = createBootLog();
    
    const runner = vi.fn().mockImplementation(async (cmd, args) => {
      const fullCmd = [cmd, ...args].join(' ');
      if (fullCmd.includes('id -u')) {
        return { success: true, out: '9999\n' }; // Usuario no root
      }
      if (fullCmd.includes('stat -c %U:%G %a /usr/src/app/log/development.log')) {
        return { success: true, out: 'root:root 644\n' };
      }
      if (fullCmd.includes('tmp/.probe')) {
        return { success: true, out: '' }; // tmp escribible
      }
      return { success: false, err: 'Unknown command' };
    });

    const probe = new CanvasWorkspaceProbe(boot, '/canvas', { runner });
    const result = await probe.runChecks();

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('CANVAS_LOG_PERMISSION_DENIED');
    expect(result.errors[0].details).toBe('root:root 644');
    
    expect(boot.error).toHaveBeenCalledWith('Se detectaron problemas de permisos en los volúmenes de Canvas.');
  });

  it('passes when development.log belongs to docker user', async () => {
    const boot = createBootLog();
    
    const runner = vi.fn().mockImplementation(async (cmd, args) => {
      const fullCmd = [cmd, ...args].join(' ');
      if (fullCmd.includes('id -u')) {
        return { success: true, out: '9999\n' };
      }
      if (fullCmd.includes('stat -c %U:%G %a /usr/src/app/log/development.log')) {
        return { success: true, out: 'docker:docker 644\n' };
      }
      if (fullCmd.includes('tmp/.probe')) {
        return { success: true, out: '' };
      }
      return { success: false, err: 'Unknown command' };
    });

    const probe = new CanvasWorkspaceProbe(boot, '/canvas', { runner });
    const result = await probe.runChecks();

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(boot.success).toHaveBeenCalledWith('Workspace verificado correctamente.');
  });

  it('detects CANVAS_TMP_PERMISSION_DENIED when tmp is not writable', async () => {
    const boot = createBootLog();
    
    const runner = vi.fn().mockImplementation(async (cmd, args) => {
      const fullCmd = [cmd, ...args].join(' ');
      if (fullCmd.includes('id -u')) {
        return { success: true, out: '9999\n' };
      }
      if (fullCmd.includes('stat -c %U:%G %a /usr/src/app/log/development.log')) {
        return { success: true, out: 'docker:docker 644\n' };
      }
      if (fullCmd.includes('tmp/.probe')) {
        return { success: false, err: 'touch: cannot touch \'/usr/src/app/tmp/.probe\': Permission denied' };
      }
      return { success: false, err: 'Unknown command' };
    });

    const probe = new CanvasWorkspaceProbe(boot, '/canvas', { runner });
    const result = await probe.runChecks();

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('CANVAS_TMP_PERMISSION_DENIED');
  });
});
