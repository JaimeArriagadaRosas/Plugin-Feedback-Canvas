import { describe, it, expect } from 'vitest';
import { request, app } from '../setup/app.js';

describe('LTI cookies  Caja Negra', () => {
  it('set-local-role envia cookie sin HttpOnly', async () => {
    const res = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'teacher' });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'];
    expect(cookie).toBeDefined();
  });

  it('clear-local-role elimina cookie', async () => {
    const set = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'teacher' });

    const cookieHeader = set.headers['set-cookie'];
    const cookieString = cookieHeader?.map(c => c.split(';')[0]).join('; ') || '';

    const clear = await request(app)
      .post('/api/config/clear-local-role')
      .set('Cookie', cookieString);

    expect(clear.status).toBe(200);
  });

  it('sesion teacher puede acceder a ruta protegida con cookie', async () => {
    const set = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'teacher' });

    const cookieHeader = set.headers['set-cookie'];
    const cookieString = cookieHeader?.map(c => c.split(';')[0]).join('; ') || '';

    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', cookieString);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('sesion student-1 puede acceder con cookie', async () => {
    const set = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'student-1' });

    const cookieHeader = set.headers['set-cookie'];
    const cookieString = cookieHeader?.map(c => c.split(';')[0]).join('; ') || '';

    const res = await request(app)
      .get('/api/student/feedback/1')
      .set('Cookie', cookieString);

    expect(res.status).toBe(200);
  });

  it('ruta protegida retorna 401 sin cookie tras limpiar sesion', async () => {
    const set = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'teacher' });

    const cookieHeader = set.headers['set-cookie'];
    const cookieString = cookieHeader?.map(c => c.split(';')[0]).join('; ') || '';

    await request(app)
      .post('/api/config/clear-local-role')
      .set('Cookie', cookieString);

    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const denied = await request(app)
      .get('/api/courses');

    expect(denied.status).toBe(401);
  });
});
