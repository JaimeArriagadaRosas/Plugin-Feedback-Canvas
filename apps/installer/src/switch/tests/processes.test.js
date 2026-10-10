import { test } from 'vitest';
import assert from 'node:assert/strict';
import { inspectProcesses, stillOwned } from '../inspection/ProcessInspector.js';
test('el escáner jamás selecciona el proceso del instalador', () => {
  const result = inspectProcesses(process.cwd());
  assert.ok(typeof result.supported === 'boolean');
  assert.ok(!result.processes.some(p => p.pid === process.pid || p.pid === process.ppid));
});
test('una identidad de proceso inexistente no se considera propia', () => {
  assert.equal(stillOwned(99999999, 'invalid', process.cwd()), false);
});
