import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PLUGIN_DIR = path.resolve(__dirname, '..', '..', '..', '..');

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', 'logs', 'tmp', 'scratch', '.backups', 'canvas-lms-master'
]);
const SCAN_IGNORE = [
  /[\\/]validation[\\/]/,
  /verify-https\.mjs$/,
  /vite\.config\.js$/,
  /SSLCertificateManager\.js$/,
  /test_installer\.mjs$/,
  /LTITokenService\.js$/,
];

export function isIgnored(file) {
  return SCAN_IGNORE.some((re) => re.test(file));
}

const SCAN_EXTS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.env', '.yml', '.yaml',
  '.md', '.html', '.sh', '.bat', '.toml', '.rb', '.cf', '.conf', '.example', '.xml',
]);
export const SCAN_ROOTS = [
  path.join(PLUGIN_DIR, 'apps', 'client', 'src'),
  path.join(PLUGIN_DIR, 'apps', 'server', 'src'),
  path.join(PLUGIN_DIR, 'config')
];

export function collectFiles(dir, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collectFiles(full, acc);
    } else if (SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
      acc.push(full);
    }
  }
  return acc;
}

export function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

export function hostsResolves(host) {
  const hostsPath = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts';
  const hosts = readFileSafe(hostsPath);
  return hosts.split(/\r?\n/).some((line) => {
    const t = line.trim();
    return t && !t.startsWith('#') && t.includes(host) && /127\.0\.0\.1/.test(t);
  });
}

export function readEnvObj(p) {
  const out = {};
  const c = readFileSafe(p);
  for (const line of c.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) out[t.slice(0, i)] = t.slice(i + 1).trim();
  }
  return out;
}
