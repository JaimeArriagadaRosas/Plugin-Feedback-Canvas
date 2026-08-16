import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getCanvasDirectory, getPluginDirectory } from '../../src/installation/utils/LocalWorkspacePaths.js';

describe('LocalWorkspacePaths', () => {
  it('locates Canvas next to the default plugin repository', () => {
    expect(getCanvasDirectory()).toBe(path.resolve(getPluginDirectory(), '..', 'canvas-lms-master'));
  });

  it('allows defining an explicit Canvas location', () => {
    expect(getCanvasDirectory({ CANVAS_LMS_DIR: '/work/canvas' })).toBe(path.resolve('/work/canvas'));
  });
});
