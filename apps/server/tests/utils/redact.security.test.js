import { describe, it, expect } from 'vitest';
import { redactSensitiveStrings } from '../../src/security/redact.js';

describe('redact.js Security', () => {
  it('Debe redactar parámetros sensibles en un query string o URL', () => {
    const urls = [
      'http://localhost/oauth2/canvas/callback?code=SUPER_SECRET_CODE&state=VERY_SECRET_STATE',
      '/api/v1/files/1?token=CANVAS_OAUTH_TOKEN',
      'code=12345&state=67890',
      'https://canvas.instructure.com/login/oauth2/auth?client_id=1&response_type=code&state=MY_STATE&redirect_uri=x',
      '/callback?access_token=SECRET_ACCESS&foo=visible',
      '?refresh_token=SECRET_REFRESH&bar=123',
      'id_token=SECRET_ID_TOKEN'
    ];

    urls.forEach(url => {
      const cleanUrl = redactSensitiveStrings(url);
      expect(cleanUrl).not.toContain('SUPER_SECRET_CODE');
      expect(cleanUrl).not.toContain('VERY_SECRET_STATE');
      expect(cleanUrl).not.toContain('CANVAS_OAUTH_TOKEN');
      expect(cleanUrl).not.toContain('12345');
      expect(cleanUrl).not.toContain('67890');
      expect(cleanUrl).not.toContain('MY_STATE');
      expect(cleanUrl).not.toContain('SECRET_ACCESS');
      expect(cleanUrl).not.toContain('SECRET_REFRESH');
      expect(cleanUrl).not.toContain('SECRET_ID_TOKEN');

      // Assert that it's replaced by [REDACTED]
      expect(cleanUrl).toContain('[REDACTED]');
    });

    // Validar conservación exacta de elementos no sensibles
    const mixedUrl = '/oauth2/canvas/callback?code=SECRET_CODE&state=SECRET_STATE&foo=visible';
    const mixedClean = redactSensitiveStrings(mixedUrl);
    expect(mixedClean).toBe('/oauth2/canvas/callback?code=[REDACTED]&state=[REDACTED]&foo=visible');
  });

  it('No debe afectar otros parámetros inofensivos', () => {
    const url = 'http://localhost/callback?code=SECRET&courseId=101&state=SECRET_STATE';
    const cleanUrl = redactSensitiveStrings(url);
    expect(cleanUrl).toContain('courseId=101');
    expect(cleanUrl).toContain('code=[REDACTED]');
    expect(cleanUrl).toContain('state=[REDACTED]');
  });
});
