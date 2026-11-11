import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/orchestration/cli.js', () => ({
  ask: vi.fn().mockResolvedValue('6')
}));

import { runBlackBoxTests } from '../../src/orchestration/testRunner.js';

let previous;
afterEach(() => {
  if (previous === undefined) delete process.env.CANVAS_LMS_DIR;
  else process.env.CANVAS_LMS_DIR = previous;
  vi.restoreAllMocks();
});

describe('El menú de caja negra integra el diagnóstico 6', () => {
  it('mantiene opciones 1-5 y ejecuta 6 sin iniciar servidores cuando Canvas falta', async () => {
    previous = process.env.CANVAS_LMS_DIR;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-option6-'));
    const pluginDir = path.join(root, 'plugin');
    fs.mkdirSync(pluginDir);
    process.env.CANVAS_LMS_DIR = path.join(root, 'canvas-inexistente');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await runBlackBoxTests(pluginDir);
      expect(result).toBe(false);
      const output = log.mock.calls.map(args => args.join(' ')).join('\n');
      for (let i = 1; i <= 6; i++) expect(output).toContain(`[${i}]`);
      expect(output).toContain('Diagnóstico de Canvas');
      expect(output).toContain('Incompleto');
      const reports = fs.readdirSync(path.join(pluginDir, 'logs', 'canvas-diagnostics'));
      expect(reports).toHaveLength(1);
      const record = JSON.parse(fs.readFileSync(path.join(pluginDir, 'logs', 'canvas-diagnostics', reports[0])));
      expect(record.status).toBe('incomplete');
      expect(record.checks[0].code).toBe('CANVAS_FILES');
      expect(record.support.status).toBe('incomplete');
      expect(record.support.primaryCode).toBe('CANVAS_FILES');
      expect(record.support.nextStep).toContain('Verificar la ubicación');
      expect(output).toContain('RESUMEN TÉCNICO PARA SOPORTE (COPIAR)');
      expect(output).toContain('INTERPRETACIÓN DEL DIAGNÓSTICO');
      expect(output).toContain('SIGUIENTE PASO RECOMENDADO');
      for (const line of record.support.summaryLines) expect(output).toContain(line);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
