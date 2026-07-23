import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request, app } from '../setup/app.js';
import { truncateAll, seedTemplate, seedAssignmentConfig } from '../setup/db.js';

describe('Rate limit  Caja Negra', () => {
  beforeEach(async () => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
    process.env.WEBHOOK_SECRET = 'secret';
    process.env.NODE_ENV = 'test';
    await truncateAll();
    await seedTemplate({ id: 1, nombre: 'Template', contenido: 'Contenido' });
    await seedAssignmentConfig({ profesor_id: '1' });
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('limite de webhook bloquea burst de eventos', async () => {
    const payload = { event_name: 'grade_change', course_id: 14852, assignment_id: 101, user_id: 1, grade: 9 };
    const body = JSON.stringify(payload);
    const sig = (await import('node:crypto')).default.createHmac('sha256', 'secret').update(body).digest('base64');

    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/webhooks/canvas')
        .set('x-canvas-signature', sig)
        .set('x-canvas-event-id', `evt-burst-${i}`)
        .send(payload);
      expect(res.status).toBeLessThan(400);
    }

    const blocked = await request(app)
      .post('/api/webhooks/canvas')
      .set('x-canvas-signature', sig)
      .set('x-canvas-event-id', 'evt-burst-last')
      .send(payload);

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.mensaje).toContain('Límite de webhooks excedido');
  });
});
