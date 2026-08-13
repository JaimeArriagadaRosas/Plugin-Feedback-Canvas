import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getCanvasDirectory, getPluginDirectory } from '../../src/installation/utils/LocalWorkspacePaths.js';

describe('LocalWorkspacePaths', () => {
  it('ubica Canvas junto al repositorio del plugin por defecto', () => {
    expect(getCanvasDirectory()).toBe(path.resolve(getPluginDirectory(), '..', 'canvas-lms-master'));
  });

  it('permite definir una ubicación explícita de Canvas', () => {
    expect(getCanvasDirectory({ CANVAS_LMS_DIR: '/work/canvas' })).toBe('/work/canvas');
  });
});
