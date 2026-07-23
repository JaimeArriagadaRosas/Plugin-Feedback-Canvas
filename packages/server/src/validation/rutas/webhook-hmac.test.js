import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request, app } from '../setup/app.js';
import crypto from 'node:crypto';
import { truncateAll, seedTemplate, seedAssignmentConfig } from '../setup/db.js';

describe('Webhook HMAC  Caja Negra', () => {
  const secret = 'webhook-secret-test';
  const basePayload = { event_name: 'grade_change', course_id: 14852, assignment_id: 101, user_id: 1, grade: 9 };

  async function sign(body) {
    const crypto = await import('node:crypto');
    return crypto.default.createHmac('sha256', secret).update(body).digest('base64');
  }

  beforeEach(async () => {
    process.env.WEBHOOK_SECRET = secret;
    process.env.NODE_ENV = 'test';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Template', contenido: 'Contenido' });
    await seedAssignmentConfig({ profesor_id: '1' });
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('rechaza webhook sin cabecera de firma', async () => {
    const res = await request(app)
      .post('/api/webhooks/canvas')
      .send(basePayload);

    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it('rechaza webhook con firma incorrecta', async () => {
    const body = JSON.stringify(basePayload);
    const res = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', 'bad-signature')
      .send(basePayload);

    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
    expect(res.body.error.mensaje).toContain('Firma de webhook inválida');
  });

  it('acepta webhook con firma valida', async () => {
    const body = JSON.stringify(basePayload);
    const sig = await sign(body);

    const res = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .send(basePayload);

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body.exito).toBe(true);
  });

  it('rechaza webhook si falta WEBHOOK_SECRET', async () => {
    process.env.WEBHOOK_SECRET = '';
    const body = JSON.stringify(basePayload);

    const res = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', 'any')
      .send(basePayload);

    expect(res.status).toBe(401);
  });
});
