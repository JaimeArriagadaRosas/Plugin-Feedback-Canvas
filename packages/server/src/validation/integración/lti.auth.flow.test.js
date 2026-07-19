import { ADMIN_COOKIE } from '../setup/testAuth.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { request, app } from '../setup/app-nock.js';
import db from '../../data/db.js';
import EncryptionService from '../../services/infrastructure/EncryptionService.js';

describe('Integración  Flujo de autenticación LTI / OAuth', () => {
  beforeEach(async () => {
    process.env.TEST_USE_REAL_CANVAS = 'true';
    await db.query('TRUNCATE canvas_user_tokens CASCADE');
    const enc = EncryptionService.encrypt('mocked-token-123');
    await db.query(`
      INSERT INTO canvas_user_tokens (canvas_sub, access_token) 
      VALUES ('local-user-admin', $1)
      ON CONFLICT (canvas_sub) DO UPDATE SET access_token = EXCLUDED.access_token
    `, [enc]);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('establece token mediante cookie y accede a ruta protegida mockeando Canvas', async () => {
    // Edge Mocking: Canvas /users/self
    nock('https://canvas.test')
      .get('/api/v1/users/self')
      .reply(200, { id: 12345, name: 'Teacher Test' });

    // Y mock de cursos
    nock('https://canvas.test')
      .get('/api/v1/users/self/courses')
      .query(true)
      .reply(200, [{ id: 14852, name: 'Curso Prueba' }]);

    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', [ADMIN_COOKIE]);

    // State-Based Testing
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.data[0].id).toBe(14852);
  });

  it('token inválido hacia Canvas bloquea acceso', async () => {
    nock('https://canvas.test')
      .get('/api/v1/users/self')
      .reply(401, { status: 'unauthorized' });

    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', ['lti-token=invalid-token']);

    expect(res.status).toBe(401);
  });

  it('acceso a API requiere autorización (401)', async () => {
    const res = await request(app).get('/api/config/me');
    expect(res.status).toBe(401);
  });
});
