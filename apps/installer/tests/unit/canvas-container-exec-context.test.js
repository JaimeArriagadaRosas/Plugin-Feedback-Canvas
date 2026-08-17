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
  it('executes Bundler inside asynchronous context without root user by default', async () => {
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

  it('does not alter commands that do not run inside a container', async () => {
    const command = ['compose', 'ps', '-q', 'web'];
    const result = await withCanvasWorkspaceContext(command);
    expect(result).toBe(command);
  });
});
