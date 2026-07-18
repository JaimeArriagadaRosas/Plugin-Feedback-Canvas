import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Caja Negra — Verificación funcional de la MIGRACIÓN HTTP → HTTPS
 * =================================================================
 * Valida el comportamiento observable del sistema bajo HTTPS sin depender de
 * la implementación interna del socket TLS:
 *  - Las URLs de configuración expuestas al cliente usan https.
 *  - Las cookies LTI se marcan secure + SameSite=None bajo HTTPS (requerido
 *    para ser enviadas dentro del iframe cross-site de Canvas).
 *  - No se exponen URLs http:// en las respuestas de configuración.
 *  - El flujo OIDC LTI redirige a una URL https:// (no degrada a http).
 *  - El endpoint de salud responde y las cabeceras no contienen mixed content.
 *
 * Nota: supertest ejercita el stack real sobre HTTP en memoria; aquí lo que
 * se prueba es el CONTRATO HTTPS (valores de configuración y atributos de
 * cookie) que el navegador consumirá cuando el servidor escuche en TLS.
 */

// Forzar modo HTTPS antes de importar el app (el middleware lee env en arranque).
process.env.NODE_ENV = 'production';
process.env.HTTPS = 'true';
process.env.VITE_USE_LOCAL_DATA = 'true';
process.env.USE_LOCAL_DATA = 'true';
process.env.LOCAL_USER_ROLE = 'admin';
process.env.GEMINI_API_KEY = 'test-key';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.CANVAS_BASE_URL = 'https://localhost:8080';
process.env.CANVAS_ISSUER = 'https://localhost:8080';
process.env.CANVAS_OIDC_URL = 'https://localhost:8080/api/lti/authorize_redirect';
process.env.LTI_REDIRECT_URI = 'https://localhost:3000/api/lti/callback';
process.env.FRONTEND_URL = 'https://localhost:5173';
process.env.VITE_BACKEND_URL = 'https://localhost:3000';

const { request, app } = await import('../setup/secureApp.js');

describe('Caja Negra — Migración HTTPS', () => {
  describe('Configuración expuesta al cliente', () => {
    it('GET /api/config/startup-mode expone URLs base en https', async () => {
      const res = await request(app).get('/api/config/startup-mode');
      expect([200, 401]).toContain(res.status);
      if (res.status === 200 && res.body) {
        const s = JSON.stringify(res.body);
        expect(s).not.toMatch(/http:\/\/(localhost|127\.0\.0\.1|canvas\.(local|docker))/);
      }
    });

    it('GET /api/config/me no expone URLs http:// heredadas', async () => {
      const res = await request(app).get('/api/config/me');
      // 200 en modo local (admin) o 401 si la sesión no está; en ambos casos
      // el cuerpo no debe contener referencias http:// a localhost.
      expect([200, 401]).toContain(res.status);
      if (res.body) {
        expect(JSON.stringify(res.body)).not.toMatch(/http:\/\/localhost:3000/);
      }
    });
  });

  describe('Cookies seguras bajo HTTPS', () => {
    it('El login LTI emite cookie lti_state con secure y SameSite=None', async () => {
      const res = await request(app)
        .post('/api/lti/login')
        .type('form')
        .send({
          iss: 'https://localhost:8080',
          login_hint: '86157096483e6b3a50bfedc6bac902',
          target_link_uri: 'https://localhost:3000/api/lti/callback',
        });

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const joined = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie || '');
      // Bajo HTTPS (NODE_ENV=production) las cookies deben ser secure + SameSite=None
      // para ser transportadas dentro del iframe cross-site de Canvas.
      expect(joined).toMatch(/Secure/i);
      expect(joined).toMatch(/SameSite=None/i);
    });

    it('El login LTI redirige a Canvas OIDC sobre https (sin degradar a http)', async () => {
      const res = await request(app)
        .post('/api/lti/login')
        .type('form')
        .send({
          iss: 'https://localhost:8080',
          login_hint: '86157096483e6b3a50bfedc6bac902',
          target_link_uri: 'https://localhost:3000/api/lti/callback',
        });

      expect([301, 302]).toContain(res.status);
      expect(res.headers.location).toBeDefined();
      expect(res.headers.location).toMatch(/^https:\/\//);
      expect(res.headers.location).toContain('/api/lti/authorize_redirect');
    });
  });

  describe('Salud y cabeceras', () => {
    it('GET /api/health responde 200 y sin mixed content en cabeceras', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      // Las cabeceras no deben referenciar recursos http:// inseguros.
      const headersStr = JSON.stringify(res.headers);
      expect(headersStr).not.toMatch(/http:\/\/(localhost|127\.0\.0\.1)/);
    });

    it('Content-Security-Policy presente (mitiga mixed content)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('JWKS (firma LTI sobre HTTPS)', () => {
    it('GET /api/lti/jwks expone la clave pública sin material privado', async () => {
      const res = await request(app).get('/api/lti/jwks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.keys)).toBe(true);
      expect(res.body.keys[0]?.kty).toBe('RSA');
      expect(res.body.keys[0]?.d).toBeUndefined();
    });
  });
});
