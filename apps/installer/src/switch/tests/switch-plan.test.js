import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../SwitchPlan.js';
test('separa recursos y preserva el clon Canvas', () => {
  const p = buildPlan({ git:{destination:'english-version', lockfileChanged:true},
    workspace:{canvasExists:true,canvasAssets:true,dist:true,viteCache:true,setupComplete:true, profiles:true,canvasProfiles:true,dependencies:true},
    docker:{projects:[{name:'canvas',containers:[{id:'abc'}],volumes:[{name:'db'}]}]} });
  assert.equal(p.canvas.preserveClone,true);
  assert.equal(p.projects[0].volumes[0].name,'db');
  assert.equal(p.cleanup.setupMarker,true);
  assert.equal(p.cleanup.canvasProfiles,true);
  assert.equal(p.dependencies,true);
});
