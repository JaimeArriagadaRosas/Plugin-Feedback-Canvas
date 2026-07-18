import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';

describe('Integracin  Flujo de autenticacin LTI', () => {
  beforeEach(() => {
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
  });

  it('establece sesin local mediante API y accede a ruta protegida', async () => {
    const setRes = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'teacher' });

    expect(setRes.status).toBe(200);
    expect(setRes.body.role).toBe('teacher');

    const cookieHeader = setRes.headers['set-cookie'];
    const cookieString = cookieHeader?.map(c => c.split(';')[0]).join('; ') || '';

    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', cookieString);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('limpiar sesin local bloquea acceso posterior', async () => {
    const setRes = await request(app)
      .post('/api/config/set-local-role')
      .send({ role: 'teacher' });

    const cookieHeader = setRes.headers['set-cookie'];
    const cookieString = cookieHeader?.map(c => c.split(';')[0]).join('; ') || '';

    const clearRes = await request(app)
      .post('/api/config/clear-local-role')
      .set('Cookie', cookieString);

    expect(clearRes.status).toBe(200);

    const res = await request(app)
      .get('/api/courses')
      .set('Cookie', cookieString);

    expect(res.status).toBe(401);
  });

  it('/api/config/me retorna identidad con sesin teacher', async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';

    const res = await request(app)
      .get('/api/config/me')
      .set('Cookie', 'lti_token=dev-token');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('teacher');
  });

  it('/api/config/me retorna identidad con sesin student', async () => {
    process.env.LOCAL_USER_ROLE = 'student-1';

    const res = await request(app)
      .get('/api/config/me')
      .set('Cookie', 'lti_token=dev-token');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('student');
    expect(res.body.studentId).toBe(1);
  });
});
