import { describe, it, expect } from 'vitest';
import { request, app } from '../setup/app.js';

describe('Auth routes  Caja Negra', () => {
  it('retorna 401 en ruta protegida sin autenticacion', async () => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it('retorna 401 con JWT malformado', async () => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', 'Bearer token.invalido.xyz');

    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it('retorna 401 con JWT vacio', async () => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
  });

  it('retorna 401 con Authorization header sin Bearer', async () => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', 'Token abc');

    expect(res.status).toBe(401);
  });

  it('set-local-role rechaza roles invalidos', async () => {
    const res = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'hacker' });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
  });

  it('set-local-role acepta rol teacher valido', async () => {
    const res = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'teacher' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('teacher');
  });

  it('config/me retorna 401 sin sesion activa en modo no-local', async () => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const res = await request(app).get('/api/config/me');

    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it('local-login rechaza credenciales vacias', async () => {
    const res = await request(app)
      .post('/api/auth/local-login')
      .send({ email: '', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.exito).toBe(false);
  });

  it('local-login rechaza credenciales invalidas', async () => {
    const res = await request(app)
      .post('/api/auth/local-login')
      .send({ email: 'unknown@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it('local-login acepta credenciales validas y devuelve dev-token', async () => {
    const res = await request(app)
      .post('/api/auth/local-login')
      .send({ email: 'profesor@canvas.local', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devToken).toContain('dev-token');
    expect(res.body.user.rol).toBe('teacher');
  });
});
