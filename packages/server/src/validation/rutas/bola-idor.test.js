import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll, seedFeedback, seedTemplate } from '../setup/db.js';

describe('BOLA / IDOR  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'student-1';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Template', contenido: 'Contenido' });
  });

  it('estudiante puede ver su propio feedback', async () => {
    await seedFeedback({ estudiante_id: 1, curso_id: 14852, tarea_id: 101, estado: 'generado' });

    const res = await request(app).get('/api/student/feedback/1');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('estudiante NO puede ver feedback de otro estudiante', async () => {
    await seedFeedback({ estudiante_id: 2, curso_id: 14852, tarea_id: 101, estado: 'generado' });

    const res = await request(app).get('/api/student/feedback/2');
    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  it('estudiante NO puede listar feedback global', async () => {
    const res = await request(app).get('/api/feedback/list');
    expect(res.status).toBe(403);
  });

  it('estudiante NO puede acceder a configuracion de tokens', async () => {
    const res = await request(app).get('/api/config/tokens');
    expect(res.status).toBe(403);
  });

  it('estudiante NO puede actualizar modelo IA', async () => {
    const res = await request(app)
      .put('/api/config/ia-model')
      .send({ servicio: 'gemini', modelo: 'gemini-1.5-pro', temperatura: 0.7, longitud_maxima: 1024, endpoint_api: 'https://test' });

    expect(res.status).toBe(403);
  });

  it('estudiante NO puede acceder a templates', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(403);
  });
});
