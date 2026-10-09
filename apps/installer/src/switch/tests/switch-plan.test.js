import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../SwitchPlan.js';
test('no propone limpiar recursos inexistentes', () => {
  const plan = buildPlan({
    git: { destination: 'english-version', lockfileChanged: false },
    workspace: { dist: false, viteCache: false, dependencies: true, canvasExists: true },
    docker: { available: true, projects: [] }
  });
  assert.equal(plan.cleanup.dist, false);
  assert.equal(plan.cleanup.viteCache, false);
  assert.equal(plan.cleanup.dockerStop, false);
  assert.equal(plan.canvas.preserveClone, true);
  assert.equal(plan.canvas.preserveVolumes, true);
});
test('detecta reconstrucción selectiva sin proponer borrar volúmenes', () => {
  const plan = buildPlan({
    git: { destination: 'english-version', lockfileChanged: true },
    workspace: { dist: true, viteCache: true, dependencies: true, setupComplete: true, canvasExists: true },
    docker: { available: true, projects: [{ count: 2 }] }
  });
  assert.equal(plan.cleanup.dist, true);
  assert.equal(plan.cleanup.viteCache, true);
  assert.equal(plan.cleanup.dockerStop, true);
  assert.equal(plan.dependencies, true);
  assert.equal(plan.canvas.preserveVolumes, true);
});
