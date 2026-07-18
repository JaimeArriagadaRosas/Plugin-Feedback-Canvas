import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request, app } from '../setup/app.js';

describe('Error handler  Caja Negra', () => {
  let originalLocalRole;
  let originalUseLocalData;
  let originalViteUseLocalData;

  beforeEach(() => {
    originalLocalRole = process.env.LOCAL_USER_ROLE;
    originalUseLocalData = process.env.USE_LOCAL_DATA;
    originalViteUseLocalData = process.env.VITE_USE_LOCAL_DATA;
  });

  afterEach(() => {
    process.env.LOCAL_USER_ROLE = originalLocalRole;
    process.env.USE_LOCAL_DATA = originalUseLocalData;
    process.env.VITE_USE_LOCAL_DATA = originalViteUseLocalData;
  });

  it('formato consistente en validaciones de entrada (400)', async () => {
    const res = await request(app).get('/api/courses/abc/assignments');

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.mensaje).toBeDefined();
    expect(res.body.error.codigo).toBe(400);
  });

  it('formato consistente en 401', async () => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const unauthorized = await request(app).get('/api/courses');

    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body.exito).toBe(false);
    expect(unauthorized.body.error).toBeDefined();
    expect(unauthorized.body.error.codigo).toBe(401);
    expect(unauthorized.body.error.timestamp).toBeDefined();
    expect(unauthorized.body.error.path).toBeDefined();
  });

  it('formato consistente en 403', async () => {
    process.env.LOCAL_USER_ROLE = 'student-1';

    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.codigo).toBe(403);
    expect(res.body.error.timestamp).toBeDefined();
  });

  it('formato consistente en 500', async () => {
    const res = await request(app)
      .post('/api/config/tokens')
      .send({ servicio: 'servicio-invalido', key: 'x' });

    expect(res.status).toBe(500);
    expect(res.body.exito).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.codigo).toBe(500);
    expect(res.body.error.timestamp).toBeDefined();
  });
});
