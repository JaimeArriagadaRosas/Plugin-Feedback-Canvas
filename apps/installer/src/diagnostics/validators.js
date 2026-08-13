import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { PLUGIN_DIR, isIgnored, readFileSafe, hostsResolves, readEnvObj } from './fileSystem.js';
import { state, ok, warn, fail, info } from './logger.js';

export const LOCAL_HTTP_RE = /\bhttp:\/\/(localhost|127\.0\.0\.1|canvas\.(local|docker))(:\d+)?/;
export const IMS_VOCAB = /purl\.imsglobal\.org|imsglobal\.org\/spec|imsglobal\.org\/vocab/i;
const HTTP_URL_RE = /\bhttp:\/\/[^\s"'`>\]]+/g;

function fileExists(file) {
  try {
    return fs.statSync(file).size > 0;
  } catch {
    return false;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function localHttpsUrl(value) {
  if (typeof value !== 'string') return true;
  if (!/(localhost|127\.0\.0\.1|canvas\.(local|docker))/i.test(value)) return true;
  return value.startsWith('https://');
}

export function scanHttpReferences(files) {
  const hits = [];
  for (const file of files) {
    if (isIgnored(file)) continue;
    const content = readFileSafe(file);
    if (!content) continue;
    HTTP_URL_RE.lastIndex = 0;
    let match;
    while ((match = HTTP_URL_RE.exec(content)) !== null) {
      const url = match[0];
      if (IMS_VOCAB.test(url)) continue;
      const line = content.substring(0, match.index).split('\n').length;
      hits.push({ file, line, url });
    }
  }
  return hits;
}

export function isExpectedInternalHttp(hit) {
  if (/http:\/\/(localhost|127\.0\.0\.1):(?:3001|8080)\b/i.test(hit.url)) return true;
  const normalized = hit.file.replaceAll('\\', '/');
  return normalized.endsWith('/security/cors.js');
}

export async function validateCerts() {
  const certDir = path.join(PLUGIN_DIR, 'apps', 'server', 'certs');
  const cert = path.join(certDir, 'localhost.pem');
  const key = path.join(certDir, 'localhost-key.pem');
  if (fileExists(cert) && fileExists(key)) {
    ok('Certificado y clave TLS locales encontrados', path.relative(PLUGIN_DIR, certDir));
    return true;
  }
  fail('Certificados TLS locales incompletos', path.relative(PLUGIN_DIR, certDir), 'El servidor local no puede iniciar HTTPS.', 'ALTO');
  return false;
}

export function validateEnv() {
  const envPath = path.join(PLUGIN_DIR, '.env');
  const env = readEnvObj(envPath);
  if (!fileExists(envPath)) {
    warn('.env no existe', 'Se validarán solamente defaults y configuración versionada.');
    return false;
  }

  const urlKeys = ['CANVAS_BASE_URL', 'CANVAS_ISSUER', 'LTI_REDIRECT_URI', 'LTI_OIDC_URL'];
  const invalid = urlKeys.filter(key => env[key] && !localHttpsUrl(env[key]));
  if (invalid.length) {
    fail('Variables locales usan HTTP', invalid.join(', '), 'Canvas/LTI puede bloquear contenido mixto.', 'ALTO');
    return false;
  }
  if (env.HTTPS === 'false') warn('HTTPS está desactivado en .env', 'No es compatible con el flujo LTI local completo.');
  else ok('Variables locales compatibles con HTTPS');
  return true;
}

export function validateLtiPlacement() {
  const file = path.join(PLUGIN_DIR, 'config', 'lti_placement.json');
  const config = readJson(file);
  if (!config) {
    fail('Configuración LTI inválida o ausente', path.relative(PLUGIN_DIR, file), 'No puede registrarse la herramienta.', 'ALTO');
    return false;
  }
  const urls = [config.public_jwk_url, config.target_link_uri, config.oidc_initiation_url];
  const extensionUrls = (config.extensions || []).flatMap(extension => [
    extension?.settings?.icon_url,
    ...(extension?.settings?.placements || []).map(placement => placement.target_link_uri)
  ]);
  if ([...urls, ...extensionUrls].filter(Boolean).every(localHttpsUrl)) {
    ok('Placement LTI usa HTTPS en URLs locales');
    return true;
  }
  fail('Placement LTI contiene una URL local HTTP', path.relative(PLUGIN_DIR, file), 'El navegador puede bloquear el launch.', 'ALTO');
  return false;
}

export function validateSecurityHeaders() {
  const file = path.join(PLUGIN_DIR, 'apps', 'server', 'src', 'security', 'headers.js');
  const content = readFileSafe(file);
  const hasCsp = content.includes('contentSecurityPolicy') && content.includes('frameAncestors');
  const hasHsts = content.includes('hsts:');
  if (hasCsp && hasHsts) ok('CSP frame-ancestors y HSTS están configurados');
  else fail('Cabeceras HTTPS incompletas', path.relative(PLUGIN_DIR, file), 'Se debilita la protección del tool LTI.', 'ALTO');
  return hasCsp && hasHsts;
}

export function validateCodeDefaults(files) {
  const relevant = files.filter(file => !isIgnored(file));
  const insecure = scanHttpReferences(relevant).filter(hit => (
    LOCAL_HTTP_RE.test(hit.url) && !isExpectedInternalHttp(hit)
  ));
  if (!insecure.length) {
    ok('Defaults locales sin referencias HTTP relevantes');
    return true;
  }
  warn('Persisten defaults HTTP locales', `${insecure.length} referencia(s); revisar el listado anterior.`);
  return false;
}

function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = value => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1200);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function requestHttps(port) {
  return new Promise(resolve => {
    const request = https.get({ hostname: 'localhost', port, path: '/', timeout: 2000 }, response => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.once('timeout', () => { request.destroy(); resolve(0); });
    request.once('error', () => resolve(0));
  });
}

export async function validateConnectivity() {
  for (const port of [3000, 8443]) {
    if (!(await portOpen(port))) {
      warn(`Puerto HTTPS ${port} no está escuchando`, 'Inicie el entorno local para validar conectividad real.');
      continue;
    }
    const status = await requestHttps(port);
    if (status) ok(`HTTPS responde en localhost:${port}`, `HTTP ${status}`);
    else fail(`El puerto ${port} está abierto, pero TLS no responde`, '', 'Puede existir un servicio HTTP plano en el puerto HTTPS.', 'ALTO');
  }
}

export function validateDocker() {
  try {
    const output = execSync('docker info --format "{{.ServerVersion}}"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000
    }).trim();
    ok('Daemon Docker accesible', output ? `Server ${output}` : 'activo');
    return true;
  } catch {
    warn('Docker no está disponible', 'La configuración HTTPS puede revisarse, pero Canvas local no puede validarse.');
    return false;
  }
}

export function applyFixes() {
  if (!state.fix) return;
  info('Modo --fix', 'No se aplicaron cambios automáticos: URLs, certificados y hosts requieren revisión explícita.');
}

export function validateHosts() {
  if (hostsResolves('canvas.docker')) ok('canvas.docker resuelve a loopback en hosts');
  else warn('canvas.docker no está mapeado a 127.0.0.1', 'Ejecute npm run setup:hosts con privilegios explícitos.');
}
