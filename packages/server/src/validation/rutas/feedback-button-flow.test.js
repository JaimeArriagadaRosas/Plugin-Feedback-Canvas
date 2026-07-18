import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { signLtiIdToken, jwksForTestKid } from '../setup/ltiTokenFactory.js';
import { storeNonce } from '../../security/nonceStore.js';

/**
 * Caja Negra — Flujo del botón "Feedback" (course_navigation LTI 1.3).
 *
 * Objetivo: reproducir de forma determinista lo que hace el navegador al pulsar
 * el botón en Canvas y detectar por qué se obtiene
 * "localhost no ha enviado ningún dato" (ERR_EMPTY_RESPONSE).
 *
 * El flujo real es:
 *   1. Canvas navega al target_link_uri (POST /api/lti/callback) con login_hint
 *      => el backend lo detecta como OIDC Initiation y delega en loginHandler,
 *      que redirige (302) a Canvas authorize_redirect.
 *   2. Canvas hace POST de vuelta a /api/lti/callback con el id_token firmado.
 *
 * Para el paso 2 montamos un JWKS de prueba en-process y apuntamos
 * CANVAS_BASE_URL a él ANTES de importar el app, de modo que el LTITokenService
 * (instanciado una sola vez al cargar el módulo) resuelva la clave contra
 * nuestro JWKS, igual que contra Canvas Local pero sin Docker ni red externa.
 */

// Mutar env ANTES de importar el app (el LTITokenService se instancia al cargar).
process.env.CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'http://127.0.0.1:0';
process.env.CANVAS_ISSUER = 'http://localhost:8080';

let jwksServer;
let request;
let app;

function startJwksServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/api/lti/security/jwks')) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(jwksForTestKid()));
      } else {
        res.statusCode = 404;
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const ROLE_TEACHER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';

function baseClaims(overrides = {}) {
  return {
    iss: 'http://localhost:8080',
    sub: 'user-123',
    aud: process.env.LTI_CLIENT_ID || '10000000000002',
    azp: process.env.LTI_CLIENT_ID || '10000000000002',
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000) - 5,
    nonce: 'nonce-abc',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'deploy-1',
    'https://purl.imsglobal.org/spec/lti/claim/roles': [ROLE_TEACHER],
    'https://purl.imsglobal.org/spec/lti/claim/context': { id: '1', title: 'Curso' },
    'https://purl.imsglobal.org/spec/lti/claim/lis': { person_name: 'Profesor', person_email: 'p@x.com' },
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
    ...overrides
  };
}

describe('Caja Negra — Flujo botón Feedback (course_navigation LTI 1.3)', () => {
  beforeAll(async () => {
    const s = await startJwksServer();
    jwksServer = s.server;
    // Redirigir el verificador de tokens a nuestro JWKS en-process.
    process.env.CANVAS_BASE_URL = s.baseUrl;
    // Import dinámico DESPUÉS de mutar el env, para que LTITokenService
    // se instancie apuntando a nuestro JWKS de prueba.
    const mod = await import('../setup/app.js');
    request = mod.request;
    app = mod.app;
  });

  afterAll(() => {
    jwksServer?.close();
  });

  it('Paso 1: POST /api/lti/callback con login_hint => OIDC Initiation (302 a Canvas authorize)', async () => {
    const res = await request(app)
      .post('/api/lti/callback')
      .type('form')
      .send({
        iss: 'http://localhost:8080',
        login_hint: '86157096483e6b3a50bfedc6bac902',
        target_link_uri: 'https://localhost:3000/api/lti/callback',
        lti_message_hint: 'hint-1',
        client_id: '10000000000002'
      });

    expect([301, 302]).toContain(res.status);
    // loginHandler redirige directo a Canvas authorize_redirect (flujo OIDC).
    expect(res.headers.location).toContain('/api/lti/authorize_redirect');
    expect(res.headers.location).toContain('client_id=10000000000002');
  });

  it('Paso 2: GET /api/lti/authorize reenvía a Canvas (ruta pública OIDC)', async () => {
    const res = await request(app)
      .get('/api/lti/authorize')
      .query({
        client_id: '10000000000002',
        login_hint: '86157096483e6b3a50bfedc6bac902',
        nonce: 'nonce-abc',
        prompt: 'none',
        redirect_uri: 'http://localhost:3000/api/lti/callback',
        response_mode: 'form_post',
        response_type: 'id_token',
        scope: 'openid',
        state: 'state-xyz'
      });

    expect([301, 302]).toContain(res.status);
    // Reenvía a la Canvas real (CANVAS_BASE_URL efectivo, que en este test
    // apunta al JWKS server en-process). El path debe ser /api/lti/authorize.
    const expectedBase = (process.env.CANVAS_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
    expect(res.headers.location).toContain(`${expectedBase}/api/lti/authorize`);
    expect(res.headers.location).toContain('client_id=10000000000002');
  });

  it('Paso 3 OK: POST /api/lti/callback con id_token válido => responde 302 (NO se cuelga)', async () => {
    const nonce = 'nonce-abc';
    storeNonce(nonce);
    const idToken = signLtiIdToken(baseClaims({ nonce }));

    const res = await request(app)
      .post('/api/lti/callback')
      .type('form')
      .set('Cookie', ['lti_state=state-xyz; lti_nonce=' + nonce])
      .send({ id_token: idToken, state: 'state-xyz' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('localhost:5173');
  }, 10000);

  it('Paso 3 FAIL kid desconocido: debe responder 401, NO colgarse', async () => {
    storeNonce('nonce-abc');
    const idToken = signLtiIdToken(baseClaims(), { kid: 'kid-inexistente' });

    const res = await request(app)
      .post('/api/lti/callback')
      .type('form')
      .set('Cookie', ['lti_state=state-xyz; lti_nonce=nonce-abc'])
      .send({ id_token: idToken, state: 'state-xyz' });

    // El JWKS no tiene ese kid => jwks-rsa debe fallar rapido (timeout 6s),
    // no dejar la conexión abierta.
    expect(res.status).toBe(401);
  }, 10000);

  it('Paso 3 FAIL iss SaaS en entorno local: documenta el comportamiento', async () => {
    storeNonce('nonce-abc');
    // Esto replica el iss del log real: https://canvas.instructure.com
    const idToken = signLtiIdToken(
      baseClaims({ iss: 'https://canvas.instructure.com' })
    );

    const res = await request(app)
      .post('/api/lti/callback')
      .type('form')
      .set('Cookie', ['lti_state=state-xyz; lti_nonce=nonce-abc'])
      .send({ id_token: idToken, state: 'state-xyz' });

    // El allow-list de issuer incluye canvas.instructure.com, así que la
    // verificación de firma pasa; el test solo debe documentar el status.
    expect([301, 302, 401, 403]).toContain(res.status);
  }, 10000);
});
