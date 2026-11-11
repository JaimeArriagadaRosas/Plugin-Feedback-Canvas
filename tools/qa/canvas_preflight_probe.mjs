// Read-only gateway for a disposable Docker QA Compose project.
import fs from 'node:fs';
import path from 'node:path';
import { checkCanvasDatabasePreflight } from '../../apps/installer/src/installation/CanvasDatabasePreflight.js';

const folder = process.argv[2];
const qaRoot = path.join(process.env.HOME || '/nonexistent', 'qa-feedback-20261110', 'artifacts');
if (process.env.QA_ALLOW_CANVAS_PREFLIGHT_REAL_E2E !== 'true' ||
    process.env.PLUGIN_TEST_MODE !== 'true' ||
    process.env.PLUGIN_QA_NO_BROWSER !== 'true' ||
    !folder || !fs.existsSync(folder) ||
    !fs.realpathSync(folder).startsWith(fs.realpathSync(qaRoot)+path.sep) ||
    !/^qa-preflight-[a-f0-9]{12}$/.test(path.basename(folder))) {
  throw new Error('Only disposable isolated QA Canvas preflight probes allowed');
}
const output = await checkCanvasDatabasePreflight(folder);
const allowed = ['ready','stopped','missing','schema_incomplete','identity_conflict','unavailable'];
if (!allowed.includes(output.state)) throw new Error('Unexpected QA preflight state');
console.log('QA_CANVAS_PREFLIGHT_STATE='+JSON.stringify({
  state:output.state,
  catalog:output.catalog ? Object.fromEntries(Object.entries(output.catalog).map(([k,v])=>[k,Boolean(v)])) : null
}));
