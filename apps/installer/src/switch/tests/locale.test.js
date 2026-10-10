import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectWorkspace } from '../inspection/WorkspaceInspector.js';
import { buildPlan } from '../SwitchPlan.js';
test('si falta Canvas no se planifica eliminar su clon', t => {
 const base = fs.mkdtempSync(path.join(os.tmpdir(),'switch-workspace-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 fs.mkdirSync(path.join(base,'repo'));
 const workspace = inspectWorkspace(path.join(base,'repo'));
 const plan = buildPlan({git:{destination:'english-version',lockfileChanged:false},workspace,docker:{projects:[]}});
 assert.equal(plan.canvas.exists,false);
 assert.equal(plan.canvas.preserveClone,true);
 assert.equal(plan.projects.length,0);
});
test('un cambio de lockfile prepara dependencias sin arrancar modo 3', () => {
 const plan = buildPlan({git:{destination:'english-version',lockfileChanged:true},workspace:{dependencies:true},docker:{projects:[]}});
 assert.equal(plan.dependencies,true);
});
