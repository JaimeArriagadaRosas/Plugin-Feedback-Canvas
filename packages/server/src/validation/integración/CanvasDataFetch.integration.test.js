import { ADMIN_COOKIE } from '../setup/testAuth.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { request, app } from '../setup/app-nock.js';
import db from '../../data/db.js';

import EncryptionService from '../../services/infrastructure/EncryptionService.js';

describe('Canvas Data Fetching (Cursos y Tareas)', () => {
  beforeEach(async () => {
    await db.query('TRUNCATE canvas_user_tokens CASCADE');
    process.env.TEST_USE_REAL_CANVAS = 'true';
    
    // Preparar un token válido en la BD para el test
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

  it('GET /api/courses/:courseId/assignments debe obtener tareas y rúbricas desde Canvas', async () => {
    const courseId = '101';
    
    // Mockeamos la llamada saliente a Canvas
    nock('https://canvas.test')
      .get(`/api/v1/courses/${courseId}/assignments`)
      .query(true)
      .reply(200, [
        {
          id: 555,
          name: 'Ensayo Final',
          due_at: '2026-12-01T23:59:00Z',
          rubric: [{ id: 'crit1', description: 'Redacción' }]
        }
      ]);

    const res = await request(app)
      .get(`/api/courses/${courseId}/assignments`)
      .set('Cookie', [ADMIN_COOKIE]); // Admin-token mock map a 'local-user-admin'

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data[0].name).toBe('Ensayo Final');
  });

  it('GET /api/courses/:courseId/students debe obtener lista de estudiantes', async () => {
    const courseId = '101';
    
    nock('https://canvas.test')
      .get(`/api/v1/courses/${courseId}/users`)
      .query(true)
      .reply(200, [
        { id: 99, name: 'Estudiante Prueba' }
      ]);

    const res = await request(app)
      .get(`/api/courses/${courseId}/students`)
      .set('Cookie', [ADMIN_COOKIE]);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.data[0].name).toBe('Estudiante Prueba');
  });
});
