import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll } from '../setup/db.js';

describe('Config routes  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'admin';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
  });

  it('getTokens retorna 200', async () => {
    const res = await request(app).get('/api/config/tokens');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('saveToken retorna 201/200 confirmando registro', async () => {
    const res = await request(app)
      .post('/api/config/tokens')
      .send({ servicio: 'gemini', key: 'key-prueba-123' });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.mensaje).toContain('registrada');
  });

  it('saveToken rechaza servicio no soportado', async () => {
    const res = await request(app)
      .post('/api/config/tokens')
      .send({ servicio: 'servicio-invalido', key: 'key-prueba' });

    expect(res.status).toBe(500);
    expect(res.body.exito).toBe(false);
  });

  it('setIAModel retorna 200 confirmando cambio', async () => {
    const res = await request(app)
      .put('/api/config/ia-model')
      .send({ servicio: 'gemini', modelo: 'gemini-1.5-pro', temperatura: 0.7, longitud_maxima: 1024, endpoint_api: 'https://test' });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });
  it('rechaza acceso a getTokens si el usuario es teacher (403)', async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    const res = await request(app).get('/api/config/tokens');
    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  it('rechaza acceso a saveToken si el usuario es student (403)', async () => {
    process.env.LOCAL_USER_ROLE = 'student-1';
    const res = await request(app)
      .post('/api/config/tokens')
      .send({ servicio: 'gemini', key: 'key-prueba-123' });
    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  it('rechaza acceso a setIAModel si el usuario es teacher (403)', async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    const res = await request(app)
      .put('/api/config/ia-model')
      .send({ servicio: 'gemini', modelo: 'gemini-1.5-pro', temperatura: 0.7, longitud_maxima: 1024, endpoint_api: 'https://test' });
    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });
});
