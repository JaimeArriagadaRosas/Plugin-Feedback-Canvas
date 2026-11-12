import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from './utils/Runner.js';

// Preflight is purely observational: do not run compose up, migrate, restart,
// repair, alter volumes or write to a Canvas database from this module.
const SQL = `BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
  'accounts',to_regclass('public.accounts') IS NOT NULL,
  'terms',to_regclass('public.terms_of_services') IS NOT NULL,
  'shards',to_regclass('public.switchman_shards') IS NOT NULL,
  'migrations',to_regclass('public.schema_migrations') IS NOT NULL
);
ROLLBACK;`;
const options = { captureAll: true, timeout: 15000 };

function parseCatalog(output) {
  const rows = String(output || '').split('\n').map(x => x.trim())
    .filter(x => /^\{.*\}$/.test(x));
  if (rows.length !== 1) return null;
  try {
    const data = JSON.parse(rows[0]);
    const names = ['accounts', 'terms', 'shards', 'migrations'];
    return names.every(name => typeof data[name] === 'boolean') ? data : null;
  } catch {
    return null;
  }
}

export async function checkCanvasDatabasePreflight(canvasDir, { execute = runCommand } = {}) {
  const cwd = path.resolve(canvasDir);
  const query = async (args, extra = {}) => {
    try {
      return await execute('docker', args, { ...options, cwd, ...extra });
    } catch {
      return { success: false, out: '' };
    }
  };
  // Compose ps does not create resources or start any services.
  const listed = await query(['compose', 'ps', '-a', '-q', 'postgres']);
  if (!listed.success) return { state: 'unavailable' };
  const ids = String(listed.out || '').trim().split(/\s+/).filter(Boolean);
  if (ids.length === 0) return { state: 'missing' };
  if (ids.length !== 1 || !/^[0-9a-f]{12,64}$/i.test(ids[0])) {
    return { state: 'identity_conflict' };
  }
  const inspected = await query(['inspect', ids[0], '--format', '{{json .}}']);
  if (!inspected.success) return { state: 'unavailable' };
  let entry;
  try { entry = JSON.parse(inspected.out); } catch { return { state: 'unavailable' }; }
  const labels = entry?.Config?.Labels || {};
  const labelDir = labels['com.docker.compose.project.working_dir'];
  // Refuse to inspect a container associated with a different Compose tree.
  // No symlink-based bypass: resolve both canonical filesystem locations.
  let sameDir = false;
  try {
    sameDir = !!labelDir && fs.realpathSync(labelDir) === fs.realpathSync(cwd);
  } catch { /* fail closed on missing or inaccessible owner directory */ }
  if (!sameDir || !labels['com.docker.compose.project'] ||
      labels['com.docker.compose.service'] !== 'postgres') {
    return { state: 'identity_conflict' };
  }
  if (entry?.State?.Running !== true) {
    return { state: 'stopped' };
  }
  const check = await query(['exec', '-i', '-e', 'PGOPTIONS=-c default_transaction_read_only=on',
    ids[0], 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', 'canvas_development'], { input: SQL });
  const catalog = check.success ? parseCatalog(check.out) : null;
  if (!catalog) return { state: 'unavailable' };
  return Object.values(catalog).every(Boolean)
    ? { state: 'ready', catalog }
    : { state: 'schema_incomplete', catalog };
}
