import { describe, expect, it } from 'vitest';

import { getCanvasDirectoryState } from '../../src/installation/installers/CanvasDirectoryState.js';

describe('CanvasDirectoryState', () => {
  it('permite reutilizar únicamente un Canvas reconocible', () => {
    expect(getCanvasDirectoryState({ targetExists: true, composeExists: true })).toBe('ready');
  });

  it('bloquea el reemplazo automático de una carpeta existente no reconocida', () => {
    expect(getCanvasDirectoryState({ targetExists: true, composeExists: false }))
      .toBe('unsafe-existing-directory');
  });

  it('permite clonar solamente cuando el destino no existe', () => {
    expect(getCanvasDirectoryState({ targetExists: false, composeExists: false })).toBe('missing');
  });
});
