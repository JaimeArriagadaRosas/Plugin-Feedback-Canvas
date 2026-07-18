import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll } from '../setup/db.js';

describe('Integracin  Ciclo de vida de Plantillas', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
  });

  it('ciclo: crear  leer  actualizar  eliminar', async () => {
    const createRes = await request(app)
      .post('/api/templates')
      .send({ nombre: 'Ciclo Vida', contenido: 'Contenido inicial' });

    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id;

    const getRes = await request(app).get(`/api/templates/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.nombre).toBe('Ciclo Vida');

    const updateRes = await request(app)
      .put(`/api/templates/${id}`)
      .send({ nombre: 'Ciclo Vida Editada', contenido: 'Contenido editado' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.nombre).toBe('Ciclo Vida Editada');

    const deleteRes = await request(app).delete(`/api/templates/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.mensaje).toContain('eliminada');

    const getAfterDelete = await request(app).get(`/api/templates/${id}`);
    expect(getAfterDelete.status).toBe(200);
  });

  it('crear plantilla sin contenido retorna 400 (con validación de campos)', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({ nombre: 'Sin Contenido' });

    expect(res.status).toBe(400);
  });
});
