import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCommand } from '../../src/installation/utils/Runner.js';

const files = [];

afterEach(() => {
  while (files.length) fs.rmSync(files.pop(), { force: true });
});

function temporaryLog() {
  const filename = path.join(os.tmpdir(), `canvas-runner-${Date.now()}-${files.length}.log`);
  files.push(filename);
  return filename;
}

describe('runCommand', () => {
  it('no conserva un registro completo cuando un proceso pesado termina bien', async () => {
    const logFile = temporaryLog();
    const result = await runCommand(process.execPath, ['-e', "console.log('salida-efimera')"], {
      logFile,
      logMode: 'on-failure'
    });

    expect(result.success).toBe(true);
    expect(fs.existsSync(logFile)).toBe(false);
  });

  it('guarda el resumen final si el proceso falla', async () => {
    const logFile = temporaryLog();
    const result = await runCommand(process.execPath, ['-e', "console.error('encryption key is incorrect'); process.exit(1)"], {
      logFile,
      logMode: 'on-failure'
    });

    expect(result.success).toBe(false);
    expect(fs.readFileSync(logFile, 'utf8')).toContain('encryption key is incorrect');
  });
});
