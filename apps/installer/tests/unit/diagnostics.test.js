import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { analyzeLogAndDiagnose, readLogTail } from '../../src/installation/utils/Diagnostics.js';

const files = [];

afterEach(() => {
  while (files.length) fs.rmSync(files.pop(), { force: true });
});

function createLog(contents) {
  const filename = path.join(os.tmpdir(), `canvas-diagnostics-${Date.now()}-${files.length}.log`);
  fs.writeFileSync(filename, contents);
  files.push(filename);
  return filename;
}

describe('Diagnostics', () => {
  it('identifica una clave de cifrado incompatible antes de sugerir reconstruir assets', () => {
    const log = createLog('bundle install completado\nencryption key is incorrect.\n');

    expect(analyzeLogAndDiagnose(log)).toMatchObject({ type: 'CANVAS_ENCRYPTION_KEY_MISMATCH' });
  });

  it('lee solo el final de registros grandes', () => {
    const log = createLog(`inicio-no-debe-estar\n${'salida-intermedia\n'.repeat(6000)}final-importante\n`);

    const tail = readLogTail(log, 128);

    expect(tail).toContain('final-importante');
    expect(tail).not.toContain('inicio-no-debe-estar');
  });
});
