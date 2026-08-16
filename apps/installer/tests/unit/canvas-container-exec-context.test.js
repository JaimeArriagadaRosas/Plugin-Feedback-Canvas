import { describe, expect, it, vi } from 'vitest';
import { withCanvasWorkspaceContext } from '../../src/installation/utils/CanvasContainerExecContext.js';

vi.mock('../../src/installation/installers/DockerInstaller.js', () => ({
  DockerInstaller: class {
    async getRuntimeState() {
      return { backend: 'docker-engine-linux' };
    }
  }
}));

vi.mock('../../src/platform/shared/ContainerExecutionPolicy.js', () => ({
  ContainerExecutionPolicy: class {
    getExecutionArgs() {
      return ['-e', 'HOME=/tmp', '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'];
    }
  }
}));

describe('withCanvasWorkspaceContext', () => {
  it('ejecuta Bundler dentro del contexto asincrono sin user root por defecto', async () => {
    const result = await withCanvasWorkspaceContext([
      'compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'check'
    ]);
    expect(result).toEqual([
      'compose', 'exec', '-T', '-e', 'HOME=/tmp',
      '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin', '-e', 'DISABLE_SPRING=1',
      'web', 'bundle', 'check'
    ]);
    expect(result).not.toContain('--user');
    expect(result).not.toContain('root');
  });

  it('no altera comandos que no ejecutan dentro de un contenedor', async () => {
    const command = ['compose', 'ps', '-q', 'web'];
    const result = await withCanvasWorkspaceContext(command);
    expect(result).toBe(command);
  });
});
