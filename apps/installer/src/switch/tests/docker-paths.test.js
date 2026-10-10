import { test } from 'vitest';
import assert from 'node:assert/strict';
import { sameDockerPath } from '../inspection/DockerInspector.js';

test('rutas Linux equivalentes y diferentes', () => {
  assert.equal(sameDockerPath('/home/user/canvas/', '/home/user/canvas', 'linux'), true);
  assert.equal(sameDockerPath('/home/user/canvas', '/home/user/other', 'linux'), false);
});
test('Docker Desktop en Windows normaliza separadores, unidades y mayúsculas', () => {
  assert.equal(sameDockerPath('C:\\Dev\\Canvas', 'c:/dev/canvas/', 'win32'), true);
  assert.equal(sameDockerPath('/run/desktop/mnt/host/c/Dev/Canvas', 'C:\\Dev\\Canvas', 'win32'), true);
  assert.equal(sameDockerPath('/host_mnt/c/Dev/Canvas', 'c:/dev/canvas', 'win32'), true);
  assert.equal(sameDockerPath('D:/Dev/Canvas', 'C:/Dev/Canvas', 'win32'), false);
});
test('macOS trata la ruta como sensible a mayúsculas de forma conservadora', () => {
  assert.equal(sameDockerPath('/Users/User/canvas', '/Users/User/canvas/', 'darwin'), true);
  assert.equal(sameDockerPath('/Users/User/canvas', '/users/user/canvas', 'darwin'), false);
});
