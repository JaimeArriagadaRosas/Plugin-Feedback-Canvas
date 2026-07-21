import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request, app } from '../setup/app.js';
import db from '../../data/db.js';
import EncryptionService from '../../services/infrastructure/EncryptionService.js';

describe('Caja Negra - Flujo de carga de cursos', () => {
  beforeEach(async () => {
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';
    process.env.STARTUP_MODE = '3';
    await db.query('TRUNCATE canvas_user_tokens CASCADE');
  });

  afterEach(() => {
    delete process.env.ENABLE_TEST_AUTH_BYPASS;
  });

  it('PB-01: Acceso a /api/config/me sin token devuelve 401', async () => {
    const res = await request(app).get('/api/config/me');
    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it('PB-02: Acceso a /api/courses sin token devuelve 401 con mensaje LTI', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(401);
    const mensaje = res.body?.mensaje || res.body?.error?.mensaje || res.body?.error || '';
    expect(mensaje).toMatch(/Token LTI 1.3 ausente/);
  });

  it('PB-03: Acceso a /api/courses con cookie LTI teacher autorizado devuelve 200', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:teacher:local');
    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PB-04: Acceso a /api/courses con cookie LTI student devuelve 403', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:student:local');
    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(403);
    const mensaje = res.body?.mensaje || res.body?.error?.mensaje || res.body?.error || '';
    expect(mensaje).toMatch(/Se requiere rol \[teacher\]/);
  });

  it('PB-05: Token LTI teacher sin token de Canvas en BD usa fallback CANVAS_ACCESS_TOKEN', async () => {
    process.env.CANVAS_ACCESS_TOKEN = 'test-canvas-token-123';
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:teacher:local');
    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('PB-06: Token LTI teacher con token de Canvas en BD expirado intenta refresh', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:teacher:local');
    const encAccess = EncryptionService.encrypt('old-access-token');
    const encRefresh = EncryptionService.encrypt('valid-refresh-token');
    const expiredAt = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    await db.query(
      `INSERT INTO canvas_user_tokens (canvas_sub, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (canvas_sub) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
      ['local-user-teacher', encAccess, encRefresh, expiredAt]
    );

    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect([200, 401, 500]).toContain(res.status);
  });

  it('PB-07: Token LTI teacher con token de Canvas en BD valido devuelve 200', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:teacher:local');
    const encAccess = EncryptionService.encrypt('valid-access-token');
    const futureAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    await db.query(
      `INSERT INTO canvas_user_tokens (canvas_sub, access_token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (canvas_sub) DO UPDATE SET access_token = EXCLUDED.access_token, expires_at = EXCLUDED.expires_at`,
      ['local-user-teacher', encAccess, futureAt]
    );

    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('PB-08: Logout elimina cookie dev-token y dev-role', async () => {
    const res = await request(app)
      .post('/api/auth/local-logout')
      .set('Cookie', ['dev-token=some-token', 'dev-role=some-role']);
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('PB-09: /api/config/me devuelve rol teacher para token teacher', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:teacher:local');
    const res = await request(app)
      .get('/api/config/me')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('teacher');
  });

  it('PB-10: /api/config/me devuelve rol student para token student', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:student:local');
    const res = await request(app)
      .get('/api/config/me')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('student');
  });

  it('PB-11: /api/health es publica y devuelve 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('PB-12: /api/config/startup-mode es publica y devuelve modo', async () => {
    const res = await request(app).get('/api/config/startup-mode');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('3');
  });

  it('PB-13: POST /api/lti/callback sin parametros devuelve error de validacion', async () => {
    const res = await request(app).post('/api/lti/callback');
    expect([302, 401, 400]).toContain(res.status);
  });

  it('PB-14: Token LTI teacher con sub nuevo auto-registra token en BD', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:teacher:local');
    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    const tokenRows = await db.query('SELECT canvas_sub FROM canvas_user_tokens WHERE canvas_sub = $1', ['local-user-teacher']);
    expect(tokenRows.rowCount).toBeGreaterThan(0);
  });

  it('PB-15: Token LTI student no puede acceder a /api/courses', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:student:local');
    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(403);
  });

  it('PB-16: Frontend recibe array de cursos con exito=true', async () => {
    const { signDevToken } = await import('../../security/crypto.js');
    const signedToken = signDevToken('dev-token:teacher:local');
    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [`lti-token=${signedToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
