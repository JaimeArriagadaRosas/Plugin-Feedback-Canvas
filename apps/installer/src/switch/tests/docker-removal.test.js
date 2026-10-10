import test from 'node:test';
import assert from 'node:assert/strict';
import { removeContainerAndWait } from '../steps/DockerRemoval.js';

const ok = (stdout = '') => ({ ok: true, stdout, stderr: '', code: 0 });
const fail = (stderr) => ({ ok: false, stdout: '', stderr, code: 1 });
function fake(answers) {
  const calls = [];
  return {
    calls,
    execute: async (_command, args) => {
      calls.push(args);
      if (!answers.length) throw new Error('Se consultó Docker más veces de lo previsto');
      return answers.shift();
    }
  };
}

test('espera a Docker tras un error si el estado es removing y luego desaparece', async () => {
  const docker = fake([fail('rm: timeout'), ok('removing'), ok('dead'), fail('Error: No such object: abc')]);
  const updates = [];
  const result = await removeContainerAndWait({
    id: 'abc', execute: docker.execute, sleep: async () => {},
    pollMs: 1000, maxWaitMs: 5000, onProgress: state => updates.push(state.state)
  });
  assert.equal(result.completedAfterError, true);
  assert.deepEqual(updates, ['removing', 'dead']);
  assert.equal(docker.calls.filter(args => args[0] === 'rm').length, 1);
});

test('no vuelve a borrar si el contenedor ya estaba en removing', async () => {
  const docker = fake([ok('removing'), fail('Error: No such container: abc')]);
  const result = await removeContainerAndWait({
    id: 'abc', alreadyRemoving: true, execute: docker.execute, sleep: async () => {}
  });
  assert.equal(result.completedAfterError, false);
  assert.equal(docker.calls.filter(args => args[0] === 'rm').length, 0);
});

test('no confunde la caída del daemon con un borrado completado', async () => {
  const docker = fake([ok('abc'), fail('Cannot connect to the Docker daemon')]);
  await assert.rejects(
    removeContainerAndWait({ id: 'abc', execute: docker.execute }),
    /No se pudo verificar.*Cannot connect/
  );
});

test('si Docker rechaza el borrado y no está eliminando, falla sin reintento', async () => {
  const docker = fake([fail('permission denied'), ok('running')]);
  await assert.rejects(
    removeContainerAndWait({ id: 'abc', execute: docker.execute }),
    /permission denied/
  );
  assert.equal(docker.calls.filter(args => args[0] === 'rm').length, 1);
});

test('tras la espera máxima informa estado y no repite el borrado', async () => {
  const docker = fake([ok('abc'), ok('removing'), ok('removing'), ok('dead')]);
  await assert.rejects(
    removeContainerAndWait({ id: 'abc', execute: docker.execute, sleep: async () => {}, pollMs: 1000, maxWaitMs: 2000 }),
    /sigue pendiente.*estado: dead/
  );
  assert.equal(docker.calls.filter(args => args[0] === 'rm').length, 1);
});
