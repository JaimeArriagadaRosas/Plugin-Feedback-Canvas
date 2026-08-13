import { describe, expect, it } from 'vitest';

import FileController from '../../src/controllers/FileController.js';

describe('FileController', () => {
  const controller = new FileController();

  it('acepta subdominios reales de Canvas y rechaza sufijos engañosos', () => {
    expect(controller._isTrustedHost('canvas.instructure.com')).toBe(true);
    expect(controller._isTrustedHost('evilinstructure.com')).toBe(false);
  });

  it('solo permite esquemas HTTP(S) para la vista previa', () => {
    expect(() => controller._validateUrl('file:///etc/passwd')).toThrow('Dominio de origen no permitido');
    expect(() => controller._validateUrl('no-es-url')).toThrow('URL inválida');
  });

  it('usa el endpoint vigente de Gotenberg', () => {
    const originalUrl = process.env.GOTENBERG_URL;
    process.env.GOTENBERG_URL = 'http://localhost:3001';
    expect(controller._gotenbergEndpoint()).toBe('http://localhost:3001/forms/libreoffice/convert');
    if (originalUrl === undefined) delete process.env.GOTENBERG_URL;
    else process.env.GOTENBERG_URL = originalUrl;
  });
});
