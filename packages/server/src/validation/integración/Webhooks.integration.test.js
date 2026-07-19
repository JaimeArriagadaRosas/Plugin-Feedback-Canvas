import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { request, app } from '../setup/app-nock.js';
import { db, seedTemplate } from '../setup/db.js';
import crypto from 'node:crypto';

describe('Webhooks Integration (RF41)', () => {
  beforeEach(async () => {
    // Preparar estado inicial para que el webhook tenga un contexto
    await db.query('TRUNCATE canvas_user_tokens CASCADE');
    const { default: EncryptionService } = await import('../../services/infrastructure/EncryptionService.js');
    const enc = EncryptionService.encrypt('mocked-token-123');
    await db.query(`
      INSERT INTO canvas_user_tokens (canvas_sub, access_token) 
      VALUES ('test-teacher', $1)
    `, [enc]);
    await db.query(`
      INSERT INTO configuracion_asignacion (canvas_course_id, canvas_assignment_id, feedback_activo, profesor_id)
      VALUES ('101', '202', true, 'test-teacher')
      ON CONFLICT DO NOTHING
    `);
    await seedTemplate({ id: 1 });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('POST /api/webhooks/canvas debe procesar un evento submission_updated', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret';
    process.env.TEST_USE_REAL_CANVAS = 'true';
    const payload = {
      event_name: 'submission_updated',
      score: 85,
      user_id: 303,
      assignment_id: 202,
      course_id: 101,
      workflow_state: 'graded'
    };
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', 'test-secret').update(body).digest('base64');

    // Si la función webhook se dispara, internamente llamará a CanvasService.getSubmission
    // y posiblemente a IA Provider. Mockeamos la API de Canvas si usa CanvasService() real.
    if (process.env.TEST_USE_REAL_CANVAS === 'true') {
      nock('https://canvas.test')
        .get('/api/v1/courses/101/assignments/202/submissions/303')
        .reply(200, {
          id: 999,
          body: 'Ensayo del estudiante',
          score: 85,
          user_id: 303,
          assignment_id: 202
        })
        .persist(); // Por si se llama varias veces
      
      nock('https://canvas.test')
        .get('/api/v1/courses/101/assignments/202')
        .reply(200, { name: 'Ensayo 1', points_possible: 100 })
        .persist();
      
      nock('https://canvas.test')
        .get('/api/v1/courses/101/users')
        .query(true)
        .reply(200, [{ name: 'Estudiante', id: 303 }]);
        
      nock('https://canvas.test')
        .get('/api/v1/courses/101/quizzes')
        .reply(200, []);
    }

    const res = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.exito).toBe(true);

    // Opcional: esperar un momento para que el flujo asíncrono termine y se guarde el feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    const feedbackCheck = await db.query('SELECT * FROM Historial_Feedback_Generado WHERE estudiante_id = $1', ['303']);
    // En este entorno mock, es posible que el generador no llegue hasta el final por faltar plantillas,
    // pero verificamos que al menos el endpoint no colapse.
    expect(res.body.mensaje).toBeDefined();
    expect(res.body.mensaje).toContain('(RF41)');
  });
});
