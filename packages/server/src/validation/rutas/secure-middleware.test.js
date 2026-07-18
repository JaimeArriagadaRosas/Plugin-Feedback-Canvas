import { describe, it, expect } from 'vitest';
import { request, app } from '../setup/secureApp.js';

// Pruebas del stack de middleware de produccin real (createApp): endpoint JWKS
// con clave real, cabeceras de seguridad Helmet, lmite de tamao de body y CORS.
describe('Middleware de seguridad de produccin  Caja Negra', () => {
  describe('JWKS endpoint', () => {
    it('expone la clave pblica LTI en /api/lti/jwks', async () => {
      const res = await request(app).get('/api/lti/jwks');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.keys)).toBe(true);
      expect(res.body.keys.length).toBe(1);

      const key = res.body.keys[0];
      expect(key.kty).toBe('RSA');
      expect(key.alg).toBe('RS256');
      expect(key.use).toBe('sig');
      expect(key.kid).toBeDefined();
      // Nunca debe exponerse material de clave privada
      expect(key.d).toBeUndefined();
      expect(key.p).toBeUndefined();
    });
  });

  describe('Cabeceras Helmet', () => {
    it('deshabilita x-powered-by', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('establece Content-Security-Policy con frame-ancestors para iframe de Canvas', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain('frame-ancestors');
      expect(res.headers['content-security-policy']).toMatch(/instructure|localhost/);
    });

    it('establece X-Content-Type-Options: nosniff', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('no enva X-Frame-Options (frameguard desactivado para permitir iframe)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-frame-options']).toBeUndefined();
    });
  });

  describe('Lmite de tamao de body', () => {
    it('rechaza payloads JSON mayores a 10kb (413)', async () => {
      const payloadGrande = { role: 'x'.repeat(11 * 1024) };
      const res = await request(app)
        .post('/api/config/set-local-role')
        .send(payloadGrande);

      expect(res.status).toBe(413);
    });

    it('acepta payloads pequeos dentro del lmite', async () => {
      const res = await request(app)
        .post('/api/config/set-local-role')
        .send({ role: 'teacher' });

      expect(res.status).toBe(200);
    });
  });

  describe('CORS restrictivo', () => {
    it('rechaza Origin no permitido (sin credenciales)', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil.com');

      // CORS restringido no refleja origen desconocido; la respuesta no incluye
      // Access-Control-Allow-Origin: evil.com
      expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.com');
    });

    it('acepta Origin de localhost permitido', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://localhost:5173');

      expect(res.headers['access-control-allow-origin']).toBe('https://localhost:5173');
    });
  });
});
