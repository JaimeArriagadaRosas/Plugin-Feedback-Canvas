import { describe, expect, it } from 'vitest';

import { getE2ETargetConfig } from '../../../client/tests/e2e/ltiTargetConfig.mjs';

describe('configuracion de destino E2E', () => {
  it('permite valores por defecto solo para Canvas local', () => {
    expect(getE2ETargetConfig({ E2E_TARGET: 'local' })).toMatchObject({
      isLocal: true, canvasUrl: 'https://localhost:8443', courseId: '1'
    });
  });

  it('exige todas las credenciales y parametros para Canvas real', () => {
    expect(() => getE2ETargetConfig({ E2E_TARGET: 'real' }))
      .toThrow('CANVAS_URL, CANVAS_TEST_USER, CANVAS_TEST_PASS, CANVAS_TEST_COURSE_ID');
  });

  it('rechaza localhost y redes privadas como destino real', () => {
    expect(() => getE2ETargetConfig({
      E2E_TARGET: 'real', CANVAS_URL: 'https://localhost:8443', CANVAS_TEST_USER: 'teacher',
      CANVAS_TEST_PASS: 'secret', CANVAS_TEST_COURSE_ID: '1'
    })).toThrow('CANVAS_URL publico');
  });

  it('acepta un Canvas real configurado de forma explicita', () => {
    expect(getE2ETargetConfig({
      E2E_TARGET: 'real', CANVAS_URL: 'https://canvas.example.edu', CANVAS_TEST_USER: 'teacher',
      CANVAS_TEST_PASS: 'secret', CANVAS_TEST_COURSE_ID: '42'
    })).toMatchObject({ isLocal: false, courseId: '42' });
  });
});
