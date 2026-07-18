import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll, seedTemplate } from '../setup/db.js';

describe('Input validation  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Template', contenido: 'Contenido' });
  });

  it('rechaza studentId negativo', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({ courseId: 14852, assignmentId: 101, studentId: -1, templateId: 1, grade: 9 });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
    expect(res.body.error.detalles.some(d => d.campo === 'studentId')).toBe(true);
  });

  it('rechaza grade como string vaco', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({ courseId: 14852, assignmentId: 101, studentId: 1, templateId: 1, grade: '' });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
  });

  it('rechaza campos faltantes obligatorios', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({ courseId: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
  });

  it('rechaza cursoId con valor 0', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({ courseId: 0, assignmentId: 101, studentId: 1, templateId: 1, grade: 9 });

    expect(res.status).toBe(400);
  });

  it('rechaza body nulo', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send(null);

    expect(res.status).toBe(400);
  });

  it('rechaza array en lugar de objeto en body', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send([]);

    expect(res.status).toBe(400);
  });

  it('rechaza query param studentId no numerico', async () => {
    const res = await request(app)
      .get('/api/feedback/detail')
      .query({ studentId: 'xyz', courseId: 14852 });

    expect(res.status).toBe(400);
  });

  it('rechaza templateId con decimales', async () => {
    const res = await request(app)
      .post('/api/feedback/generate')
      .send({ courseId: 14852, assignmentId: 101, studentId: 1, templateId: 1.5, grade: 9 });

    expect(res.status).toBe(400);
  });
});
