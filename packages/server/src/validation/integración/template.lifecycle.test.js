import { ADMIN_COOKIE } from '../setup/testAuth.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { request, app } from '../setup/app-nock.js';
import { truncateAll } from '../setup/db.js';

describe('Integración  Ciclo de vida de Plantillas', () => {
  beforeEach(async () => {
    process.env.TEST_USE_REAL_CANVAS = 'true';
    await truncateAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('ciclo: crear -> leer -> actualizar -> eliminar', async () => {
    // Edge Mocking: identity fetch (no es estrictamente de Canvas pero para el AuthLTI13Handler)
    nock('https://canvas.test')
      .get('/api/v1/users/self')
      .reply(200, { id: 12345, name: 'Teacher Test' })
      .persist(); // Se va a consultar varias veces

    const createRes = await request(app)
      .post('/api/templates')
      .set('Cookie', [ADMIN_COOKIE])
      .send({ nombre: 'Ciclo Vida', contenido: 'Contenido inicial' });

    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id;

    const getRes = await request(app).get(`/api/templates/${id}`)
      .set('Cookie', [ADMIN_COOKIE]);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.nombre).toBe('Ciclo Vida');

    const updateRes = await request(app)
      .put(`/api/templates/${id}`)
      .set('Cookie', [ADMIN_COOKIE])
      .send({ nombre: 'Ciclo Vida Editada', contenido: 'Contenido editado' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.nombre).toBe('Ciclo Vida Editada');

    const deleteRes = await request(app).delete(`/api/templates/${id}`)
      .set('Cookie', [ADMIN_COOKIE]);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.mensaje).toContain('eliminada');

    const getAfterDelete = await request(app).get(`/api/templates/${id}`)
      .set('Cookie', [ADMIN_COOKIE]);
    expect(getAfterDelete.status).toBe(200);
  });

  it('crear plantilla sin contenido retorna 400 (con validación de campos)', async () => {
    nock('https://canvas.test')
      .get('/api/v1/users/self')
      .reply(200, { id: 12345, name: 'Teacher Test' });

    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', [ADMIN_COOKIE])
      .send({ nombre: 'Sin Contenido' });

    expect(res.status).toBe(400);
  });
});
