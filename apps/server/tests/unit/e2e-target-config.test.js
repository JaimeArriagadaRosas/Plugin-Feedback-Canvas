import { describe, expect, it } from 'vitest';

import { getE2ETargetConfig } from '../../../client/tests/e2e/ltiTargetConfig.mjs';

describe('E2E target configuration', () => {
  it('allows default values only for local Canvas', () => {
    expect(getE2ETargetConfig({ E2E_TARGET: 'local' })).toMatchObject({
      isLocal: true, canvasUrl: 'https://localhost:8443', courseId: '1'
    });
  });

  it('requires all credentials and parameters for real Canvas', () => {
    expect(() => getE2ETargetConfig({ E2E_TARGET: 'real' }))
      .toThrow('CANVAS_URL, CANVAS_TEST_USER, CANVAS_TEST_PASS, CANVAS_TEST_COURSE_ID');
  });

  it('rejects localhost and private networks as real target', () => {
    expect(() => getE2ETargetConfig({
      E2E_TARGET: 'real', CANVAS_URL: 'https://localhost:8443', CANVAS_TEST_USER: 'teacher',
      CANVAS_TEST_PASS: 'secret', CANVAS_TEST_COURSE_ID: '1'
    })).toThrow('public CANVAS_URL');
  });

  it('accepts an explicitly configured real Canvas', () => {
    expect(getE2ETargetConfig({
      E2E_TARGET: 'real', CANVAS_URL: 'https://canvas.example.edu', CANVAS_TEST_USER: 'teacher',
      CANVAS_TEST_PASS: 'secret', CANVAS_TEST_COURSE_ID: '42'
    })).toMatchObject({ isLocal: false, courseId: '42' });
  });
});
