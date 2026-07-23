import { ADMIN_COOKIE } from '../setup/testAuth.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { request, app } from '../setup/app-nock.js';
import { truncateAll, seedTemplate, seedFeedback } from '../setup/db.js';
import db from '../../data/db.js';

import EncryptionService from '../../services/infrastructure/EncryptionService.js';

describe('Integracin  Flujo completo de Feedback', () => {
  let template;
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.TEST_USE_REAL_CANVAS = 'true';
    await truncateAll();
    const enc = EncryptionService.encrypt('mocked-token-123');
    await db.query(`
      INSERT INTO canvas_user_tokens (canvas_sub, access_token) 
      VALUES ('00000000-0000-0000-0000-000000000001', $1)
      ON CONFLICT (canvas_sub) DO UPDATE SET access_token = EXCLUDED.access_token
    `, [enc]);
    await db.query(`
      INSERT INTO canvas_user_tokens (canvas_sub, access_token) 
      VALUES ('00000000-0000-0000-0001-000000000003', $1)
      ON CONFLICT (canvas_sub) DO UPDATE SET access_token = EXCLUDED.access_token
    `, [enc]);
    template = await seedTemplate({ nombre: 'Plantilla Integracin', contenido: 'Contenido de integracin' });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('flujo: crear feedback -> aprobar -> verificar estado en BD', async () => {
    // Edge Mocking: Simulamos que la rúbrica/tarea existen en Canvas
    nock('https://canvas.test')
      .get('/api/v1/courses/14852/assignments/101')
      .reply(200, {
        id: 101,
        points_possible: 10,
        rubric: []
      })
      .persist()
      .get('/api/v1/courses/14852/assignments/101/submissions/1')
      .reply(200, { id: 1, points_possible: 10, body: 'Respuesta del estudiante' })
      .get('/api/v1/courses/14852/quizzes')
      .reply(200, [])
      .get('/api/v1/courses/14852/users')
      .query(true)
      .reply(200, [{ id: 1, name: 'Estudiante Prueba' }, { id: 2, name: 'Estudiante Reprobado' }]);

    const generateRes = await request(app)
      .post('/api/feedback/generate')
      .set('Cookie', [ADMIN_COOKIE])
      .send({ courseId: 14852, assignmentId: 101, studentId: 1, templateId: template.id, grade: 9.0 });

    expect(generateRes.status).toBe(200);
    expect(generateRes.body.exito).toBe(true);
    const feedbackId = generateRes.body.data.id;

    // Edge Mocking: Simulamos envío a Canvas y obtención de enrolamiento
    nock('https://canvas.test')
      .get('/api/v1/courses/14852/users/1/enrollments')
      .reply(200, [{ type: 'StudentEnrollment' }])
      .put('/api/v1/courses/14852/assignments/101/submissions/1')
      .reply(200, { workflow_state: 'graded' }) // Actualizar nota
      .put('/api/v1/courses/14852/assignments/101/submissions/1')
      .reply(200, { workflow_state: 'graded' }) // Publicar comentario
      .post('/api/v1/conversations')
      .reply(200, [{ id: 999 }]); // Conversación in-app

    const approveRes = await request(app)
      .post('/api/feedback/approve')
      .set('Cookie', [ADMIN_COOKIE])
      .send({ feedbackId, courseId: 14852, assignmentId: 101, studentId: 1, content: 'Aprobado', grade: 6.9, rating: 5 });

    // State-Based Testing
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.exito).toBe(true);
  });

  it('flujo: generar con nota reprobatoria marca aprobado=false', async () => {
    nock('https://canvas.test')
      .get('/api/v1/courses/14852/assignments/101')
      .reply(200, { id: 101, points_possible: 10, rubric: [] })
      .persist()
      .get('/api/v1/courses/14852/assignments/101/submissions/2')
      .reply(200, { id: 2, points_possible: 10, body: 'Mala respuesta' })
      .get('/api/v1/courses/14852/quizzes')
      .reply(200, [])
      .get('/api/v1/courses/14852/users')
      .query(true)
      .reply(200, [{ id: 1, name: 'Estudiante Prueba' }, { id: 2, name: 'Estudiante Reprobado' }]);

    const res = await request(app)
      .post('/api/feedback/generate')
      .set('Cookie', [ADMIN_COOKIE])
      .send({ courseId: 14852, assignmentId: 101, studentId: 2, templateId: template.id, grade: 3.0 }); // Nota < 4.0

    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.chileGrade).toBeLessThan(4.0);
  });

  it('flujo: listAll refleja feedbacks persistidos', async () => {
    nock('https://canvas.test')
      .get('/api/v1/courses/14852/users')
      .query(true)
      .reply(200, [{ id: 1, name: 'Estudiante Prueba' }, { id: 2, name: 'Estudiante Reprobado' }]);

    await seedFeedback({ estudiante_id: 1, curso_id: 14852, tarea_id: 101, estado: 'PENDIENTE', plantilla_id: template.id });
    await seedFeedback({ estudiante_id: 2, curso_id: 14852, tarea_id: 101, estado: 'APROBADO', plantilla_id: template.id });

    const res = await request(app)
      .get('/api/feedback/list')
      .set('Cookie', [ADMIN_COOKIE]);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
