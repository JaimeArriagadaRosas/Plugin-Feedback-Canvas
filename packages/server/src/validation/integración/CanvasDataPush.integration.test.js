import { ADMIN_COOKIE } from '../setup/testAuth.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { request, app } from '../setup/app-nock.js';
import db from '../../data/db.js';

import EncryptionService from '../../services/infrastructure/EncryptionService.js';

describe('Canvas Data Push (Envío de Feedback a Canvas)', () => {
  let pendingFeedbackId;

  beforeEach(async () => {
    await db.query('TRUNCATE canvas_user_tokens CASCADE');
    await db.query('TRUNCATE Historial_Feedback_Generado CASCADE');
    process.env.TEST_USE_REAL_CANVAS = 'true';
    
    // Preparar un token válido en la BD
    const enc = EncryptionService.encrypt('mocked-token-123');
    await db.query(`
      INSERT INTO canvas_user_tokens (canvas_sub, access_token) 
      VALUES ('local-user-admin', $1)
      ON CONFLICT (canvas_sub) DO UPDATE SET access_token = EXCLUDED.access_token
    `, [enc]);

    // Insertar un feedback en estado PENDIENTE
    const fbRes = await db.query(`
      INSERT INTO Historial_Feedback_Generado (estudiante_id, curso_id, tarea_id, contenido_generado, estado) 
      VALUES ('303', '101', '202', 'Feedback para aprobar', 'PENDIENTE')
      RETURNING id
    `);
    pendingFeedbackId = fbRes.rows[0].id;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('POST /api/feedback/approve debe enviar comentario a Canvas y marcar como APROBADO', async () => {
    // 1. Mock de Canvas API para recibir el comentario de la rúbrica (RF31)
    const scopeSubmission = nock('https://canvas.test')
      .put('/api/v1/courses/101/assignments/202/submissions/303', body => {
        // Verificar que estemos enviando el texto en el formato esperado
        return body && body.submission && body.submission.rubric_assessment;
      })
      .reply(200, { success: true });

    // Mock genérico alternativo por si usa comment en lugar de rubric_assessment en _CanvasService
    const scopeComment = nock('https://canvas.test')
      .put('/api/v1/courses/101/assignments/202/submissions/303')
      .reply(200, { success: true })
      .persist();

    // Mock de Canvas API para mensajería interna (RF42) si estuviera implementado en postComment
    const scopeMessage = nock('https://canvas.test')
      .post('/api/v1/conversations')
      .reply(200, [{ id: 999 }]);

    const res = await request(app)
      .post('/api/feedback/approve')
      .set('Cookie', [ADMIN_COOKIE]) // Middleware LTI
      .send({ 
        feedbackId: pendingFeedbackId,
        courseId: 101,
        assignmentId: 202,
        studentId: 303,
        content: 'Buen trabajo'
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);

    // Verificar en BD que cambió a APROBADO
    const dbCheck = await db.query('SELECT estado FROM Historial_Feedback_Generado WHERE id = $1', [pendingFeedbackId]);
    expect(dbCheck.rows[0].estado).toBe('APROBADO');

    // Nock verifica automáticamente que se llamaron si isDone() es true
    // Verificamos al menos que haya pasado el request
    expect(scopeComment.isDone() || scopeSubmission.isDone()).toBe(true);
  });
});
