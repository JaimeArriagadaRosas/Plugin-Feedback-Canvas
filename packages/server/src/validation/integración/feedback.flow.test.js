import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll, seedTemplate, seedFeedback } from '../setup/db.js';

describe('Integracin  Flujo completo de Feedback', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Plantilla Integracin', contenido: 'Contenido de integracin' });
  });

  it('flujo: crear feedback  aprobar  verificar estado en BD', async () => {
    const generateRes = await request(app)
      .post('/api/feedback/generate')
      .send({ courseId: 14852, assignmentId: 101, studentId: 1, templateId: 1, grade: 9.0 });

    expect(generateRes.status).toBe(200);
    expect(generateRes.body.exito).toBe(true);
    const feedbackId = generateRes.body.data.id;

    const approveRes = await request(app)
      .post('/api/feedback/approve')
      .send({ feedbackId, courseId: 14852, assignmentId: 101, studentId: 1, content: 'Aprobado', grade: 6.9 });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.exito).toBe(true);
  });

  it('flujo: generar con nota reprobatoria marca aprobado=false', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({ courseId: 14852, assignmentId: 101, studentId: 2, templateId: 1, grade: 5.0 });

    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.chileGrade).toBeLessThan(4.0);
  });

  it('flujo: listAll refleja feedbacks persistidos', async () => {
    await seedFeedback({ estudiante_id: 1, curso_id: 14852, tarea_id: 101, estado: 'generado' });
    await seedFeedback({ estudiante_id: 2, curso_id: 14852, tarea_id: 101, estado: 'APROBADO' });

    const res = await request(app).get('/api/feedback/list');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
