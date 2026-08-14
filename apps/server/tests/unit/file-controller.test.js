import { describe, expect, it } from 'vitest';

import FileController from '../../src/controllers/FileController.js';

describe('FileController', () => {
  const controller = new FileController();

  it('accepts real Canvas subdomains and rejects deceptive suffixes', () => {
    expect(controller._isTrustedHost('canvas.instructure.com')).toBe(true);
    expect(controller._isTrustedHost('evilinstructure.com')).toBe(false);
  });

  it('only allows HTTP(S) schemes for preview', () => {
    expect(() => controller._validateUrl('file:///etc/passwd')).toThrow('Origin domain not allowed');
    expect(() => controller._validateUrl('no-es-url')).toThrow('Invalid URL');
  });

  it('uses the current Gotenberg endpoint', () => {
    const originalUrl = process.env.GOTENBERG_URL;
    process.env.GOTENBERG_URL = 'http://localhost:3001';
    expect(controller._gotenbergEndpoint()).toBe('http://localhost:3001/forms/libreoffice/convert');
    if (originalUrl === undefined) delete process.env.GOTENBERG_URL;
    else process.env.GOTENBERG_URL = originalUrl;
  });
});
