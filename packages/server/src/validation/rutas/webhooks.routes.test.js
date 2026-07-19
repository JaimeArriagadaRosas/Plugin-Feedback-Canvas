import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { request, app } from '../setup/app.js';
import { truncateAll, seedTemplate, seedAssignmentConfig } from '../setup/db.js';

describe('Webhooks routes  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Template', contenido: 'Contenido' });
    await seedAssignmentConfig();
    await seedAssignmentConfig();
  });

  it('retorna 202 para evento grade_change valido', async () => {
    const secret = 'test-secret';
    process.env.WEBHOOK_SECRET = secret;
    const payload = { event_name: 'grade_change', course_id: 14852, assignment_id: 101, user_id: 1, grade: 9 };
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64');

    const res = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .send(payload);

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body.exito).toBe(true);
  });

  it('retorna 200 para evento no reconocido', async () => {
    const secret = 'test-secret';
    process.env.WEBHOOK_SECRET = secret;
    const payload = { event_name: 'unknown_event', course_id: 14852 };
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64');

    const res = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.mensaje).toBe('Evento ignorado');
  });

  it('rechaza payload JSON invalido', async () => {
    const res = await request(app)
      .post('/api/webhooks/canvas')
      .set('Content-Type', 'application/json')
      .send('invalid json');

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
