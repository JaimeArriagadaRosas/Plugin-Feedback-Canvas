import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { seedTemplate, truncateAll } from '../setup/db.js';

describe('Feedback routes  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Plantilla Estndar', contenido: 'Plantilla de prueba' });
  });

  it('listAll retorna 200 y array de feedbacks', async () => {
    const res = await request(app).get('/api/feedback/list');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('listPending retorna 200 y estadsticas', async () => {
    const res = await request(app).get('/api/feedback/pending');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('getDetail retorna 200 con historial del estudiante', async () => {
    const res = await request(app)
      .get('/api/feedback/detail')
      .query({ studentId: 1, courseId: 14852 });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('generateFeedback retorna 200 con feedback generado', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({
        courseId: 14852,
        assignmentId: 101,
        studentId: 1,
        templateId: 1,
        grade: 9.0
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.chileGrade).toBeGreaterThanOrEqual(1.0);
    expect(res.body.data.chileGrade).toBeLessThanOrEqual(7.0);
  });

  it('generateFeedback con nota negativa retorna 400 por validacin de rango', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({
        courseId: 14852,
        assignmentId: 101,
        studentId: 1,
        templateId: 1,
        grade: -5
      });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
  });

  it('approveAndSend retorna 200 confirmando envo', async () => {
    const res = await request(app)
      .post('/api/feedback/approve')
      .send({
        feedbackId: 1,
        courseId: 14852,
        assignmentId: 101,
        studentId: 1,
        content: 'Feedback aprobado',
        grade: 6.9
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('rejectFeedback marca feedback como rechazado', async () => {
    await seedTemplate({ id: 1, nombre: 'Plantilla Estndar', contenido: 'Plantilla de prueba' });

    const res = await request(app)
      .put('/api/feedback/1/reject')
      .send({ nota_obtenida: 3.5 });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('getStudentView retorna 200 con asignaciones del estudiante', async () => {
    const res = await request(app)
      .get('/api/student/feedback/1');

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
