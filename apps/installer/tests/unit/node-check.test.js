import { describe, expect, it, vi } from 'vitest';

import { NodeCheck, isSupportedNode } from '../../src/orchestration/boot/checks/node.js';

function createLog() {
  return new Proxy({}, { get: () => vi.fn() });
}

describe('NodeCheck', () => {
  it('respeta el rango de Node requerido por Vite 8', () => {
    expect(isSupportedNode('v20.18.0')).toBe(false);
    expect(isSupportedNode('v20.19.0')).toBe(true);
    expect(isSupportedNode('v22.11.0')).toBe(false);
    expect(isSupportedNode('v22.12.0')).toBe(true);
    expect(isSupportedNode('v24.0.0')).toBe(true);
  });

  it('marca npm 9 como degradado sin bloquear un runtime ya instalado', () => {
    const run = vi.fn((command) => command === 'node' ? 'v22.22.1' : '9.2.0');
    const result = new NodeCheck({ run }).run(createLog());

    expect(result).toMatchObject({
      ok: true,
      degraded: true,
      message: 'npm global distinto al fijado por el monorepo'
    });
  });

  it('acepta el runtime reproducible declarado por el monorepo', () => {
    const run = vi.fn((command) => command === 'node' ? 'v22.22.1' : '11.8.0');
    const result = new NodeCheck({ run }).run(createLog());

    expect(result).toMatchObject({ ok: true, data: { nodeVer: 'v22.22.1', npmVer: '11.8.0' } });
  });
});
