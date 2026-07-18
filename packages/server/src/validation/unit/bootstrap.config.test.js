import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SAVED = { ...process.env };

beforeEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, SAVED);
});

describe('bootstrap.resolveEnv (central config)', () => {
  it('resuelve el entorno con los defaults y usa getEnv internamente', async () => {
    const { resolveEnv } = await import('../../services/server/bootstrap.js');

    // Forzar el default de código para client_id: si algún módulo cargó el
    // .env real (p.ej. LTI_CLIENT_ID=10000000000002 tras la reinstalación LTI
    // 1.3), lo anulamos para validar el fallback '10000000000001'.
    delete process.env.CANVAS_CLIENT_ID;
    delete process.env.LTI_CLIENT_ID;

    process.env.CANVAS_BASE_URL = 'https://mi.canvas.edu';
    process.env.CANVAS_ISSUER = 'https://mi.canvas.edu';
    process.env.WEBHOOK_SECRET = 'whsec_xyz';
    process.env.LTI_DEPLOYMENT_IDS = 'dep1, dep2 ,dep3';

    const env = resolveEnv();

    expect(env.canvasBaseUrl).toBe('https://mi.canvas.edu');
    expect(env.webhookSecret).toBe('whsec_xyz');
    expect(env.canvasClientId).toBe('10000000000001'); // default de código
    expect(env.canvasIssuer).toBe('https://mi.canvas.edu');
    expect(env.allowedDeploymentIds).toEqual(['dep1', 'dep2', 'dep3']);
  });

  it('usa CANVAS_CLIENT_ID cuando está presente', async () => {
    const { resolveEnv } = await import('../../services/server/bootstrap.js');
    process.env.CANVAS_CLIENT_ID = 'cliente-123';
    const env = resolveEnv();
    expect(env.canvasClientId).toBe('cliente-123');
  });

  it('usa fallback VITE_ para CANVAS_ACCESS_TOKEN y advierte', async () => {
    const { resolveEnv } = await import('../../services/server/bootstrap.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.VITE_CANVAS_ACCESS_TOKEN = 'vite-token';
    const env = resolveEnv();
    expect(env.canvasAccessToken).toBe('vite-token');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
