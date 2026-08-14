import { describe, expect, it } from 'vitest';

import { getCanvasDirectoryState } from '../../src/installation/installers/CanvasDirectoryState.js';

describe('CanvasDirectoryState', () => {
  it('only allows reusing a recognizable Canvas', () => {
    expect(getCanvasDirectoryState({ targetExists: true, composeExists: true })).toBe('ready');
  });

  it('blocks automatic replacement of an unrecognized existing folder', () => {
    expect(getCanvasDirectoryState({ targetExists: true, composeExists: false }))
      .toBe('unsafe-existing-directory');
  });

  it('only allows cloning when the destination does not exist', () => {
    expect(getCanvasDirectoryState({ targetExists: false, composeExists: false })).toBe('missing');
  });
});
