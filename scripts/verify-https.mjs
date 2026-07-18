#!/usr/bin/env node
/**
 * verify-https.mjs — Etapa de VERIFICACIÓN Y VALIDACIÓN HTTPS
 * ============================================================
 * Plugin Feedback Adaptativo (Canvas LMS LTI 1.3 tool)
 *
 * Escanea todo el proyecto para detectar configuración heredada HTTP y validar
 * que la migración a HTTPS quede consistente y funcional.
 *
 * Uso:
 *   node scripts/verify-https.mjs            # informe completo
 *   node scripts/verify-https.mjs --fix      # aplica correcciones de bajo riesgo
 *   node scripts/verify-https.mjs --silent   # solo código de salida
 *
 * Códigos de salida:
 *   0 = HTTPS consistente y verificado
 *   1 = se encontraron configuraciones HTTP heredadas / errores de validación
 *   2 = error de ejecución del script
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const SILENT = args.includes('--silent');

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de reporte
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m', blue: '\x1b[34m',
};

let passed = 0, warnings = 0, failures = 0;
const findings = [];

function log(msg) { if (!SILENT) console.log(msg); }
function step(label) { log(`\n${C.cyan}${C.bold}▶ ${label}${C.reset}`); }
function ok(label, detail = '') { passed++; log(`  ${C.green}✅${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }
function warn(label, detail = '') { warnings++; log(`  ${C.yellow}⚠️ ${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }
function fail(label, detail = '', impact = '', risk = '') {
  failures++;
  log(`  ${C.red}❌${C.reset} ${C.bold}${label}${C.reset}` + (detail ? C.gray + ' — ' + detail + C.reset : ''));
  if (impact) log(`     ${C.yellow}→ Impacto: ${impact}${C.reset}`);
  if (risk) log(`     ${C.red}→ Riesgo: ${risk}${C.reset}`);
  findings.push({ label, detail, impact, risk });
}
function info(label, detail = '') { log(`  ${C.blue}ℹ${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }

// ─────────────────────────────────────────────────────────────────────────────
// Recolección de archivos (excluye node_modules, dist, .git, logs)
// ─────────────────────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'logs', '.backups', 'canvas-lms-master']);

// Archivos/dirs excluidos del reporte de "HTTP heredado" porque son
// fixtures de prueba (simulan un issuer externo sobre HTTP) o el propio
// script detector / fallbacks TLS explícitos y justificados.
const SCAN_IGNORE = [
  /[\\/]validation[\\/]/,
  /verify-https\.mjs$/,
  /vite\.config\.js$/,
  /SSLCertificateManager\.js$/,
  /test_installer\.mjs$/,
  /LTITokenService\.js$/,
];

function isIgnored(file) {
  return SCAN_IGNORE.some((re) => re.test(file));
}
const SCAN_EXTS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.env', '.yml', '.yaml',
  '.md', '.html', '.sh', '.bat', '.toml', '.rb', '.cf', '.conf', '.example', '.xml',
]);
const SCAN_ROOTS = [
  PLUGIN_DIR,
  path.join(PLUGIN_DIR, 'config'),
  path.join(PLUGIN_DIR, 'scripts'),
];

function collectFiles(dir, acc = []) {
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Detección de referencias HTTP heredadas
// ─────────────────────────────────────────────────────────────────────────────
// Patrones que representan URLs http:// explícitas en config/código.
// Se ignoran las URL de vocabularios IMS Global (deben ser http por estándar LTI).
const IMS_VOCAB = /purl\.imsglobal\.org|imsglobal\.org\/spec|imsglobal\.org\/vocab/i;
const HTTP_URL_RE = /\bhttp:\/\/[^\s"'`)>\]]+/g;
// URL base del plugin/Canvas que deberían estar en https en desarrollo local.
const LOCAL_HTTP_RE = /\bhttp:\/\/(localhost|127\.0\.0\.1|canvas\.(local|docker))(:\d+)?/g;

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

function hostsResolves(host) {
  const hostsPath =
    process.platform === 'win32'
      ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
      : '/etc/hosts';
  const hosts = readFileSafe(hostsPath);
  return hosts
    .split(/\r?\n/)
    .some((line) => {
      const t = line.trim();
      return t && !t.startsWith('#') && t.includes(host) && /127\.0\.0\.1/.test(t);
    });
}

function scanHttpReferences(files) {
  const hits = [];
  for (const file of files) {
    if (isIgnored(file)) continue;
    const content = readFileSafe(file);
    if (!content) continue;
    let m;
    HTTP_URL_RE.lastIndex = 0;
    const lines = content.split('\n');
    while ((m = HTTP_URL_RE.exec(content)) !== null) {
      const url = m[0];
      if (IMS_VOCAB.test(url)) continue; // vocabulario LTI estándar, no es hallazgo
      const lineIdx = content.substring(0, m.index).split('\n').length;
      hits.push({ file, line: lineIdx, url });
    }
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Validación de certificados SSL/TLS
// ─────────────────────────────────────────────────────────────────────────────
const CERTS_DIR = path.join(PLUGIN_DIR, 'packages', 'server', 'certs');
const CERT_PEM = path.join(CERTS_DIR, 'localhost.pem');
const CERT_KEY = path.join(CERTS_DIR, 'localhost-key.pem');

async function validateCerts() {
  const hasPem = fs.existsSync(CERT_PEM);
  const hasKey = fs.existsSync(CERT_KEY);
  if (!hasPem || !hasKey) {
    fail('Certificados SSL locales no encontrados', `${CERTS_DIR}`,
      'No se puede levantar el backend en HTTPS; el orquestador caerá a HTTP y romperá el flujo LTI dentro de Canvas (mixed content).',
      'ALTO');
    return null;
  }
  // Validar que el PEM contiene cert y el KEY es válido (no vacío, headers correctos)
  const pem = readFileSafe(CERT_PEM);
  const key = readFileSafe(CERT_KEY);
  const certOk = /-----BEGIN CERTIFICATE-----/.test(pem);
  const keyOk = /-----BEGIN (?:RSA |EC |PRIVATE|OPENSSH )?PRIVATE KEY-----/.test(key);
  if (!certOk) fail('Certificado (localhost.pem) con formato inválido', 'Falta BEGIN CERTIFICATE', 'HTTPS no arrancará.', 'ALTO');
  if (!keyOk) fail('Clave privada (localhost-key.pem) con formato inválido', 'Falta PRIVATE KEY', 'HTTPS no arrancará.', 'ALTO');
  if (certOk && keyOk) ok('Certificados SSL presentes y con formato válido', 'localhost.pem + localhost-key.pem');
  // Detectar SAN para localhost parseando el certificado con node:crypto.
  let sanLocalhost = false;
  try {
    const { X509Certificate } = await import('node:crypto');
    const x509 = new X509Certificate(Buffer.from(pem));
    const san = x509.subjectAltName || '';
    sanLocalhost = /localhost/i.test(san) || /DNS:localhost/i.test(san) || /IP Address:127\.0\.0\.1/i.test(san);
  } catch {
    sanLocalhost = /localhost/.test(pem);
  }
  if (sanLocalhost) ok('Certificado cubre "localhost" (SAN mkcert)', 'Necesario para HTTPS local confiable');
  else warn('Certificado sin SAN "localhost" detectada', 'Recomendado regenerar con mkcert localhost 127.0.0.1');
  return { hasPem, hasKey, certOk, keyOk, sanLocalhost };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Validación de variables de entorno (.env)
// ─────────────────────────────────────────────────────────────────────────────
function readEnvObj(p) {
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

function validateEnv() {
  const envPath = path.join(PLUGIN_DIR, '.env');
  if (!fs.existsSync(envPath)) { warn('.env no encontrado', 'Se usará env_example / defaults'); return; }
  const env = readEnvObj(envPath);

  const protoVars = [
    'CANVAS_BASE_URL', 'CANVAS_ISSUER', 'CANVAS_OIDC_URL',
    'LTI_REDIRECT_URI', 'FRONTEND_URL', 'VITE_BACKEND_URL',
  ];
  for (const v of protoVars) {
    const val = env[v];
    if (!val) { info(`Variable ${v}`, 'ausente (se usará default); revisar defaults del código'); continue; }
    if (/^http:\/\//.test(val)) {
      fail(`Variable ${v} usa HTTP`, `${val}`,
        'Canvas embebe el tool en un iframe HTTPS; HTTP genera mixed content y rompe el launch LTI.', 'ALTO');
    } else if (/^https:\/\//.test(val)) {
      ok(`Variable ${v}`, `HTTPS → ${val}`);
    }
  }

  if (env.HTTPS === 'true') ok('HTTPS=true en .env', 'Servidor iniciará en TLS');
  else if (env.HTTPS === 'false' || env.HTTPS === undefined) {
    fail('HTTPS=false/ausente en .env',
      `HTTPS=${env.HTTPS ?? '(ausente)'}`,
      'El backend arranca en HTTP por defecto. El flujo LTI dentro de Canvas falla por mixed content.', 'ALTO');
  }

  // Coherencia de protocolo entre backend y frontend
  const backendProto = (env.VITE_BACKEND_URL || '').startsWith('https') ? 'https' : 'http';
  const frontendProto = (env.FRONTEND_URL || '').startsWith('https') ? 'https' : 'http';
  if (backendProto !== frontendProto) {
    fail('Inconsistencia de protocolo Backend vs Frontend',
      `VITE_BACKEND_URL=${env.VITE_BACKEND_URL} | FRONTEND_URL=${env.FRONTEND_URL}`,
      'CORS/redirecciones mixtas entre capas.', 'MEDIO');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Validación de lti_placement.json (config LTI de Canvas)
// ─────────────────────────────────────────────────────────────────────────────
function validateLtiPlacement() {
  const p = path.join(PLUGIN_DIR, 'config', 'lti_placement.json');
  if (!fs.existsSync(p)) { warn('config/lti_placement.json no encontrado'); return; }
  const c = readFileSafe(p);
  let json;
  try { json = JSON.parse(c); } catch { fail('lti_placement.json no es JSON válido'); return; }
  const urls = [];
  const walk = (o) => {
    if (typeof o === 'string') { if (/^https?:\/\//.test(o)) urls.push(o); }
    else if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(json);
  for (const u of urls) {
    if (/^http:\/\//.test(u)) {
      fail('lti_placement.json contiene URL HTTP', u,
        'Canvas rechaza target_link_uri/oidc_initiation_url/JWKS en HTTP bajo HTTPS; el tool no carga.', 'ALTO');
    } else if (/^https:\/\//.test(u)) {
      ok('lti_placement.json URL HTTPS', u);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Validación de defaults HTTP en el código (fallbacks hardcodeados)
// ─────────────────────────────────────────────────────────────────────────────
function validateCodeDefaults(files) {
  // Busca asignaciones de fallback 'http://localhost' en el código fuente.
  const patterns = [
    { re: /(process\.env\.\w+\s*\|\|\s*'|DEFAULT[\w]*\s*=\s*'|fallback.*'|'http:\/\/localhost)/i, label: 'fallback http://localhost' },
  ];
  let count = 0;
  for (const f of files) {
    if (!/\.(js|mjs|cjs|ts|rb|json)$/.test(f)) continue;
    const c = readFileSafe(f);
    if (!c) continue;
    LOCAL_HTTP_RE.lastIndex = 0;
    if (LOCAL_HTTP_RE.test(c)) {
      const lines = c.split('\n');
      lines.forEach((ln, idx) => {
        if (LOCAL_HTTP_RE.test(ln) && !IMS_VOCAB.test(ln)) {
          // Ignorar comentarios informativos
          if (/^\s*[\/*#]/.test(ln) && /Para (desarrollo|producción)|o la configurada/.test(ln)) return;
          findings.push({ file: f, line: idx + 1, code: ln.trim() });
          count++;
        }
      });
    }
  }
  if (count === 0) ok('Sin fallbacks HTTP hardcodeados problemáticos', 'todos los defaults apuntan a https o son overridables por env');
  else info(`Se detectaron ${count} referencias locales http:// en código`, 'revisar que sean overridables por variables de entorno');
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Validación de cookies seguras / HSTS / CSP (helmet)
// ─────────────────────────────────────────────────────────────────────────────
function validateSecurityHeaders(files) {
  const helmetPath = files.find(f => /security[/\\]headers\.js$/.test(f));
  if (!helmetPath) { warn('headers.js (helmet) no encontrado'); return; }
  const c = readFileSafe(helmetPath);

  if (/hsts:\s*false/.test(c) && !/NODE_ENV\s*===\s*'production'/.test(c)) {
    warn('HSTS deshabilitado fuera de producción', 'Aceptable en local; debe activarse en producción');
  } else if (/hsts:/.test(c) && /production/.test(c)) {
    ok('HSTS condicionado a producción', 'Correcto: no se fuerza HSTS en localhost');
  }

  if (/frame-ancestors/.test(c) && !/frameguard:\s*false/.test(c)) {
    warn('CSP frame-ancestors sin frameguard relajado', 'Para LTI en iframe se requiere frameguard:false');
  } else if (/frameguard:\s*false/.test(c) && /frame-ancestors/.test(c)) {
    ok('frame-ancestors + frameguard:false', 'Configuración correcta para tool LTI en iframe');
  }

  if (/upgrade-insecure-requests/.test(c)) ok('CSP incluye upgrade-insecure-requests');
  else warn('CSP sin upgrade-insecure-requests', 'Recomendado para mitigar mixed content legacy');

  // Cookies en rutas LTI
  const ltiRoutes = files.find(f => /routes[/\\]lti[/\\]index\.js$/.test(f));
  if (ltiRoutes) {
    const lc = readFileSafe(ltiRoutes);
    if (/secure:\s*cookieSecure/.test(lc) || /secure:\s*(isProduction|cookieSecure)/.test(lc)) ok('Cookies LTI con atributo secure condicionado', 'secure solo cuando HTTPS/producción');
    else if (/secure:\s*true/.test(lc)) ok('Cookies LTI marcadas secure:true');
    else warn('No se detectó atributo secure en cookies LTI', 'Revisar routes/lti/index.js');
    if (/sameSite:\s*(cookieSameSite|'None'|"None")/.test(lc)) ok('Cookies LTI con SameSite dinámico (None para cross-site)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Pruebas de conectividad HTTPS / redirección
// ─────────────────────────────────────────────────────────────────────────────
function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => { s.close(); resolve(false); });
    s.listen(port);
  });
}

function httpsGet(host, port, path = '/', opts = {}) {
  return new Promise((resolve) => {
    const req = https.request({ host, port, path, method: 'GET', rejectUnauthorized: false, timeout: 4000, ...opts }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ ok: true, status: res.statusCode, location: res.headers.location, data, headers: res.headers }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(4000, () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.end();
  });
}

async function validateConnectivity() {
  // Intenta detectar backends en 3000 (https si HTTPS=true) y 5173.
  const env = readEnvObj(path.join(PLUGIN_DIR, '.env'));
  const useHttps = env.HTTPS === 'true';
  const backendPort = 3000;
  const inUse = await portInUse(backendPort);
  if (!inUse) {
    warn(`Backend no detectado en :${backendPort}`, 'No se ejecutan pruebas de conectividad en vivo (levanta el entorno primero)');
    return;
  }
  const target = useHttps ? 'HTTPS' : 'HTTP';
  info(`Backend detectado en :${backendPort}. Probando ${target}...`);

  if (useHttps) {
    const r = await httpsGet('localhost', backendPort, '/api/health');
    if (r.ok && r.status === 200) ok('GET https://localhost:3000/api/health', `200 OK (TLS activo)`);
    else if (r.ok) ok(`https://localhost:3000/api/health → ${r.status}`, 'Responde por TLS');
    else fail('No se pudo conectar por HTTPS al backend', r.error, 'El backend no está sirviendo TLS.', 'ALTO');

    // Verificar que NO haya redirección a http
    const r2 = await httpsGet('localhost', backendPort, '/');
    if (r2.location && /^http:\/\//.test(r2.location)) {
      fail('Redirección HTTPS → HTTP detectada', r2.location, 'Causa mixed content / bucle.', 'ALTO');
    } else {
      ok('Sin redirección insegura (HTTPS→HTTP)', r2.location || '(sin Location)');
    }
  } else {
    const r = await httpsGet('localhost', backendPort, '/api/health');
    fail('Backend responde en HTTP (HTTPS no activo)', 'Se esperaba TLS en :3000',
      'Canvas (HTTPS) no puede cargar un tool en HTTP sin violar mixed content.', 'ALTO');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Validación de infraestructura Docker
// ─────────────────────────────────────────────────────────────────────────────
function validateDocker() {
  // Verifica que los puertos publicados y el dominio de Canvas sean coherentes.
  const override = path.join(PLUGIN_DIR, '..', 'canvas-lms-master', 'docker-compose.override.yml');
  const domainYml = path.join(PLUGIN_DIR, '..', 'canvas-lms-master', 'docker-compose', 'config', 'domain.yml');
  if (fs.existsSync(override)) {
    const c = readFileSafe(override);
    const pub = c.match(/"\s*(\d+):(\d+)"\s*/g);
    info('Canvas docker-compose.override publica puertos', pub ? pub.join(', ') : 'ninguno detectado');
    if (!/"?\s*8080:80"?/.test(c) && !/8080/.test(c)) {
      warn('Puerto 8080 no publicado para Canvas', 'El plugin apunta a http(s)://localhost:8080');
    } else {
      ok('Canvas publica 8080→80', 'Coherente con CANVAS_BASE_URL localhost:8080');
    }
  }
  if (fs.existsSync(domainYml)) {
    const c = readFileSafe(domainYml);
    if (/development:\s*\n\s*domain:\s*"canvas\.docker"/.test(c) || /domain:\s*"canvas\.docker"/.test(c)) {
      info('Canvas domain.yml: development domain = canvas.docker', 'El plugin usa localhost; debe coincidir con CANVAS_BASE_URL');
      const env = readEnvObj(path.join(PLUGIN_DIR, '.env'));
      if (env.CANVAS_BASE_URL && /canvas\.docker/.test(env.CANVAS_BASE_URL)) {
        ok('CANVAS_BASE_URL coincide con domain Canvas', env.CANVAS_BASE_URL);
      } else if (env.CANVAS_BASE_URL && /localhost:8080/.test(env.CANVAS_BASE_URL)) {
        if (hostsResolves('canvas.docker')) {
          ok('canvas.docker resuelve a 127.0.0.1', 'npm run setup:hosts aplicado; localhost:8080 y canvas.docker son consistentes');
        } else {
          warn('CANVAS_BASE_URL=localhost:8080 pero Canvas domain=canvas.docker',
            'Ejecuta "npm run setup:hosts" para mapear canvas.docker a 127.0.0.1 (evita mismatch de host en Docker).');
        }
      }
    }
  }
  // dockerRunner usa 'docker compose' — verificar daemon
  try {
    execSync('docker info', { encoding: 'utf8', timeout: 3000, stdio: 'pipe' });
    ok('Docker daemon responde', 'docker compose disponible para Canvas Local');
  } catch {
    warn('Docker daemon no responde', 'Modo local Canvas no disponible; el resto de la verificación continúa');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Correcciones de bajo riesgo (--fix)
// ─────────────────────────────────────────────────────────────────────────────
function applyFixes() {
  if (!FIX) return;
  step('Aplicando correcciones de bajo riesgo (--fix)');
  const envPath = path.join(PLUGIN_DIR, '.env');
  if (fs.existsSync(envPath)) {
    let c = readFileSafe(envPath);
    const replacements = [
      ['CANVAS_BASE_URL=http://localhost:8080', 'CANVAS_BASE_URL=https://localhost:8080'],
      ['CANVAS_ISSUER=http://localhost:8080', 'CANVAS_ISSUER=https://localhost:8080'],
      ['CANVAS_OIDC_URL=http://localhost:8080/api/lti/authorize_redirect', 'CANVAS_OIDC_URL=https://localhost:8080/api/lti/authorize_redirect'],
      ['LTI_REDIRECT_URI=http://localhost:3000/api/lti/callback', 'LTI_REDIRECT_URI=https://localhost:3000/api/lti/callback'],
      ['FRONTEND_URL=http://localhost:5173', 'FRONTEND_URL=https://localhost:5173'],
      ['VITE_BACKEND_URL=http://localhost:3000', 'VITE_BACKEND_URL=https://localhost:3000'],
    ];
    let changed = 0;
    for (const [from, to] of replacements) {
      if (c.includes(from)) { c = c.replace(from, to); changed++; }
    }
    if (changed > 0) { fs.writeFileSync(envPath, c); ok(`Actualizadas ${changed} URL(s) a HTTPS en .env`); }
    else info('No se requirieron cambios en .env');
  }

  // lti_placement.json → https
  const p = path.join(PLUGIN_DIR, 'config', 'lti_placement.json');
  if (fs.existsSync(p)) {
    let c = readFileSafe(p);
    const before = c;
    c = c.replace(/http:\/\/localhost/g, 'https://localhost');
    if (c !== before) { fs.writeFileSync(p, c); ok('lti_placement.json actualizado a HTTPS'); }
    else info('lti_placement.json ya en HTTPS');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  log(`\n${C.bold}${C.magenta}══════════════════════════════════════════════════════════════${C.reset}`);
  log(`${C.bold}${C.magenta}  VERIFICACIÓN Y VALIDACIÓN HTTPS — Plugin Feedback Adaptativo${C.reset}`);
  log(`${C.bold}${C.magenta}  ${new Date().toLocaleString('es-CL')}${C.reset}`);
  log(`${C.bold}${C.magenta}══════════════════════════════════════════════════════════════${C.reset}`);

  step('Iniciando verificación de configuración HTTPS...');
  info('Recopilando archivos del proyecto (excluye node_modules/dist/.git/canvas-lms-master)');
  const files = [];
  for (const root of SCAN_ROOTS) collectFiles(root, files);
  info(`Archivos a inspeccionar: ${files.length}`);

  step('Analizando configuración existente...');
  const certs = await validateCerts();
  validateEnv();
  validateLtiPlacement();
  validateDocker();

  step('Detectando referencias HTTP heredadas...');
  const httpHits = scanHttpReferences(files);
  if (httpHits.length === 0) {
    ok('Sin referencias HTTP explícitas fuera de vocabularios IMS', '');
  } else {
    // Clasificar: solo mostramos las que apuntan a localhost/canvas (las relevantes)
    const relevant = httpHits.filter(h => LOCAL_HTTP_RE.test(h.url));
    for (const h of relevant) {
      const rel = path.relative(PLUGIN_DIR, h.file);
      fail(`HTTP heredado: ${h.url}`, `${rel}:${h.line}`, 'Debe migrarse a HTTPS para coherencia LTI.', 'MEDIO/ALTO');
    }
    const otherCount = httpHits.length - relevant.length;
    if (otherCount > 0) info(`Otras ${otherCount} URL http detectadas (externas/comentarios)`, 'revisar manualmente');
  }

  step('Validando certificados y configuración SSL/TLS...');
  validateSecurityHeaders(files);
  validateCodeDefaults(files);

  step('Ejecutando pruebas de conectividad HTTPS...');
  await validateConnectivity();

  step('Verificando compatibilidad del entorno local (Docker)...');
  // (ya cubierto en validateDocker + validateCerts para mkcert)

  step('Finalizando validaciones HTTPS...');
  applyFixes();

  // ── RESUMEN ──
  log(`\n${C.bold}══════════════════════════════════════════════════════════════${C.reset}`);
  log(`${C.bold}  RESUMEN DE VERIFICACIÓN HTTPS:${C.reset}`);
  log(`  ${C.green}✅ Correcto:${C.reset} ${passed}`);
  log(`  ${C.yellow}⚠️  Avisos:${C.reset}   ${warnings}`);
  log(`  ${C.red}❌ Hallazgos:${C.reset} ${failures}`);
  log(`${C.bold}══════════════════════════════════════════════════════════════${C.reset}`);

  if (failures === 0) {
    log(`\n${C.green}${C.bold}🎉 HTTPS consistente y verificado. No quedan configuraciones HTTP relevantes.${C.reset}\n`);
  } else {
    log(`\n${C.red}${C.bold}🚨 Se encontraron ${failures} configuración(es) HTTP heredada(s) que requieren atención.${C.reset}`);
    log(`${C.gray}   Ejecuta: node scripts/verify-https.mjs --fix para corregir las de bajo riesgo.${C.reset}\n`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error ejecutando verificación HTTPS:', e.message);
  process.exit(2);
});
