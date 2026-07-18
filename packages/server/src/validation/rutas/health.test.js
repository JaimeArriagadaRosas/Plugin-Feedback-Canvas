import { describe, it, expect } from 'vitest';
import { request, app } from '../setup/app.js';

describe('Health route  Caja Negra', () => {
  it('retorna 200 con JSON valido', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('API Operativa');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.uptime).toBeDefined();
  });

  it('retorna 405 para POST', async () => {
    const res = await request(app).post('/api/health');
    expect(res.status).toBe(405);
  });

  it('retorna 404 para ruta inexistente', async () => {
    const res = await request(app).get('/api/not-exists');
    expect(res.status).toBe(404);
  });
});
