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
  it('identifies an incompatible encryption key before suggesting rebuilding assets', () => {
    const log = createLog('bundle install completed\nencryption key is incorrect.\n');

    expect(analyzeLogAndDiagnose(log)).toMatchObject({ type: 'CANVAS_ENCRYPTION_KEY_MISMATCH' });
  });

  it('reads only the end of large logs', () => {
    const log = createLog(`start-should-not-be-there\n${'intermediate-output\n'.repeat(6000)}important-end\n`);

    const tail = readLogTail(log, 128);

    expect(tail).toContain('important-end');
    expect(tail).not.toContain('start-should-not-be-there');
  });
});
