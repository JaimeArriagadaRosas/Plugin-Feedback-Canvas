import { ADMIN_COOKIE } from '../setup/testAuth.js';
import { signOAuthState } from '../../security/crypto.js';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import nock from 'nock';
import { request, app } from '../setup/app-nock.js';
import db from '../../data/db.js';

describe('Canvas OAuth2 Integration Flow', () => {
  beforeEach(async () => {
    await db.query('TRUNCATE canvas_user_tokens CASCADE');
    process.env.TEST_USE_REAL_CANVAS = 'true';
    process.env.CANVAS_CLIENT_SECRET = 'secret_test';
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('debe retornar 401 requireOAuth si no hay token en BD al consultar /api/courses', async () => {
    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [ADMIN_COOKIE]); // El setup mockea LTI y devuelve user 'test-admin'
      
    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
    expect(res.body.error.requireOAuth).toBe(true);
    expect(res.body.error.oauthUrl).toBe('/api/oauth2/canvas/login');
  });

  it('debe iniciar el flujo OAuth2 y redirigir a Canvas', async () => {
    const res = await request(app)
      .get('/api/oauth2/canvas/login')
      .set('Cookie', [ADMIN_COOKIE]);
      
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login/oauth2/auth');
    expect(res.headers.location).toContain('client_id=');
    expect(res.headers.location).toContain('response_type=code');
  });

  it('debe procesar el callback OAuth2, guardar token y usarlo en /api/courses', async () => {
    // 1. Mock de Canvas token exchange
    nock('https://canvas.test')
      .post('/login/oauth2/token')
      .reply(200, {
        access_token: 'real_access_token',
        refresh_token: 'real_refresh_token',
        expires_in: 3600
      });

    // Sub state (00000000-0000-0000-0000-000000000001 from setup/mocks or AuthLTI13Handler bypass)
    const state = signOAuthState({ canvasSub: '00000000-0000-0000-0000-000000000001' });

    // 2. Ejecutar callback
    const resCallback = await request(app)
      .get(`/api/oauth2/canvas/callback?code=fake_auth_code&state=${state}`);
    
    expect(resCallback.status).toBe(302);
    expect(resCallback.headers.location).toContain('/'); // Redirige al frontend

    // 3. Mock de get courses (Canvas API)
    nock('https://canvas.test', {
        reqheaders: {
          authorization: 'Bearer real_access_token'
        }
      })
      .get('/api/v1/users/self/courses')
      .query(true)
      .reply(200, [{ id: 101, name: 'Curso de Prueba Nock' }]);

    // 4. Intentar /api/courses de nuevo
    const resCourses = await request(app)
      .get('/api/courses')
      .set('Cookie', [ADMIN_COOKIE]);
      
    expect(resCourses.status).toBe(200);
    expect(resCourses.body.exito).toBe(true);
    expect(resCourses.body.data[0].name).toBe('Curso de Prueba Nock');
  });
});
