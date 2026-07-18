import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll, seedTemplate } from '../setup/db.js';

describe('Templates routes  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
  });

  it('list templates retorna 200', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('create template retorna 201', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({ nombre: 'Nueva', contenido: 'Contenido' });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.data.nombre).toBe('Nueva');
  });

  it('get template por id retorna 200', async () => {
    const template = await seedTemplate({ id: 1, nombre: 'Test', contenido: 'Contenido' });

    const res = await request(app).get(`/api/templates/${template.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nombre).toBe('Test');
  });

  it('update template retorna 200', async () => {
    const template = await seedTemplate({ id: 1, nombre: 'Old', contenido: 'Old' });

    const res = await request(app)
      .put(`/api/templates/${template.id}`)
      .send({ nombre: 'New', contenido: 'New Content' });

    expect(res.status).toBe(200);
    expect(res.body.data.nombre).toBe('New');
  });

  it('delete template retorna 200', async () => {
    const template = await seedTemplate({ id: 1, nombre: 'ToDelete', contenido: 'Delete' });

    const res = await request(app).delete(`/api/templates/${template.id}`);
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toContain('eliminada');
  });

  it('rechaza acceso student a templates', async () => {
    process.env.LOCAL_USER_ROLE = 'student-1';

    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(403);
  });

  it('rechaza crear template sin nombre', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({ contenido: 'Solo contenido' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
