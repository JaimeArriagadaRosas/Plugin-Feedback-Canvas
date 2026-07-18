import { describe, it, expect } from 'vitest';
import { request, app } from '../setup/app.js';

describe('Deployment ID  Caja Negra', () => {
  it('modo local permite acceso sin restriccion de deployment', async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';

    const res = await request(app)
      .get('/api/config/me')
      .set('Cookie', 'lti_token=dev-token');

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.role).toBe('teacher');
  });

  it('rutas publicas exponen JWKS para validacion LTI', async () => {
    const res = await request(app).get('/api/lti/jwks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
  });

  it('sin token en modo no-local bloquea acceso a rutas protegidas', async () => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';

    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(401);
  });
});
