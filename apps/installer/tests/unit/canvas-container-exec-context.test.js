import { describe, expect, it } from 'vitest';

import { withCanvasWorkspaceContext } from '../../src/installation/utils/CanvasContainerExecContext.js';

describe('withCanvasWorkspaceContext', () => {
  it('ejecuta Bundler dentro del contexto que puede escribir el checkout rootless', () => {
    expect(withCanvasWorkspaceContext([
      'compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'check'
    ])).toEqual([
      'compose', 'exec', '-T', '--user', 'root', '-e', 'HOME=/tmp',
      '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin', '-e', 'DISABLE_SPRING=1',
      'web', 'bundle', 'check'
    ]);
  });

  it('no altera comandos que no ejecutan dentro de un contenedor', () => {
    const command = ['compose', 'ps', '-q', 'web'];

    expect(withCanvasWorkspaceContext(command)).toBe(command);
  });
});
