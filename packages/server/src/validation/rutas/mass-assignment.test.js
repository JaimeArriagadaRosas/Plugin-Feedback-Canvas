import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll, seedTemplate } from '../setup/db.js';

describe('Mass assignment  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Template', contenido: 'Contenido' });
  });

  it('rechaza campos extra en POST /api/feedback/generate', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({
        courseId: 14852,
        assignmentId: 101,
        studentId: 1,
        templateId: 1,
        grade: 9,
        isAdmin: true,
        role: 'admin',
        estado: 'APROBADO'
      });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
    expect(res.body.error.detalles).toBeDefined();
  });

  it('rechaza campos extra en POST /api/feedback/approve', async () => {
    const res = await request(app)
      .post('/api/feedback/approve')
      .send({
        feedbackId: 1,
        courseId: 14852,
        assignmentId: 101,
        studentId: 1,
        content: 'Aprobado',
        grade: 6.9,
        isAdmin: true,
        aprobado: true
      });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
  });

  it('rechaza campos extra en POST /api/feedback/manual', async () => {
    const res = await request(app)
      .post('/api/feedback/manual')
      .send({
        courseId: 14852,
        assignmentId: 101,
        studentId: 1,
        content: 'Manual feedback',
        templateId: 1,
        estado: 'generado',
        approved: true
      });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
  });
});
