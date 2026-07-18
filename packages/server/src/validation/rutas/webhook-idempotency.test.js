import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request, app } from '../setup/app.js';
import crypto from 'node:crypto';

describe('Webhook idempotency  Caja Negra', () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET = 'secret';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('procesa un webhook nuevo y marca como procesado', async () => {
    const payload = { event_name: 'grade_change', course_id: 14852, assignment_id: 101, user_id: 1, grade: 9 };
    const body = JSON.stringify(payload);

    const sig = crypto.createHmac('sha256', 'secret').update(body).digest('base64');

    const first = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .set('x-canvas-event-id', 'evt-new-1')
      .send(payload);

    expect(first.status).toBeGreaterThanOrEqual(200);
    expect(first.status).toBeLessThan(300);
    expect(first.body.exito).toBe(true);
  });

  it('evento duplicado retorna 202 idempotente', async () => {
    const payload = { event_name: 'grade_change', course_id: 14852, assignment_id: 101, user_id: 1, grade: 9 };
    const body = JSON.stringify(payload);

    const sig = crypto.createHmac('sha256', 'secret').update(body).digest('base64');

    const first = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .set('x-canvas-event-id', 'evt-dup-1')
      .send(payload);

    expect(first.status).toBeGreaterThanOrEqual(200);
    expect(first.status).toBeLessThan(300);

    const duplicate = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .set('x-canvas-event-id', 'evt-dup-1')
      .send(payload);

    expect(duplicate.status).toBe(202);
    expect(duplicate.body.mensaje).toContain('ya procesado');
  });
});
