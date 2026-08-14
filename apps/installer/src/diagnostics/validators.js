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
    ok('Local TLS certificate and key found', path.relative(PLUGIN_DIR, certDir));
    return true;
  }
  fail('Incomplete local TLS certificates', path.relative(PLUGIN_DIR, certDir), 'The local server cannot start HTTPS.', 'HIGH');
  return false;
}

export function validateEnv() {
  const envPath = path.join(PLUGIN_DIR, '.env');
  const env = readEnvObj(envPath);
  if (!fileExists(envPath)) {
    warn('.env does not exist', 'Only defaults and versioned configuration will be validated.');
    return false;
  }

  const urlKeys = ['CANVAS_BASE_URL', 'CANVAS_ISSUER', 'LTI_REDIRECT_URI', 'LTI_OIDC_URL'];
  const invalid = urlKeys.filter(key => env[key] && !localHttpsUrl(env[key]));
  if (invalid.length) {
    fail('Local variables use HTTP', invalid.join(', '), 'Canvas/LTI may block mixed content.', 'HIGH');
    return false;
  }
  if (env.HTTPS === 'false') warn('HTTPS is disabled in .env', 'Not compatible with the full local LTI flow.');
  else ok('Local variables compatible with HTTPS');
  return true;
}

export function validateLtiPlacement() {
  const file = path.join(PLUGIN_DIR, 'config', 'lti_placement.json');
  const config = readJson(file);
  if (!config) {
    fail('Invalid or missing LTI configuration', path.relative(PLUGIN_DIR, file), 'The tool cannot be registered.', 'HIGH');
    return false;
  }
  const urls = [config.public_jwk_url, config.target_link_uri, config.oidc_initiation_url];
  const extensionUrls = (config.extensions || []).flatMap(extension => [
    extension?.settings?.icon_url,
    ...(extension?.settings?.placements || []).map(placement => placement.target_link_uri)
  ]);
  if ([...urls, ...extensionUrls].filter(Boolean).every(localHttpsUrl)) {
    ok('LTI placement uses HTTPS in local URLs');
    return true;
  }
  fail('LTI placement contains a local HTTP URL', path.relative(PLUGIN_DIR, file), 'The browser may block the launch.', 'HIGH');
  return false;
}

export function validateSecurityHeaders() {
  const file = path.join(PLUGIN_DIR, 'apps', 'server', 'src', 'security', 'headers.js');
  const content = readFileSafe(file);
  const hasCsp = content.includes('contentSecurityPolicy') && content.includes('frameAncestors');
  const hasHsts = content.includes('hsts:');
  if (hasCsp && hasHsts) ok('CSP frame-ancestors and HSTS are configured');
  else fail('Incomplete HTTPS headers', path.relative(PLUGIN_DIR, file), 'LTI tool protection is weakened.', 'HIGH');
  return hasCsp && hasHsts;
}

export function validateCodeDefaults(files) {
  const relevant = files.filter(file => !isIgnored(file));
  const insecure = scanHttpReferences(relevant).filter(hit => (
    LOCAL_HTTP_RE.test(hit.url) && !isExpectedInternalHttp(hit)
  ));
  if (!insecure.length) {
    ok('Local defaults without relevant HTTP references');
    return true;
  }
  warn('Local HTTP defaults persist', `${insecure.length} reference(s); check the list above.`);
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
      warn(`HTTPS port ${port} is not listening`, 'Start the local environment to validate actual connectivity.');
      continue;
    }
    const status = await requestHttps(port);
    if (status) ok(`HTTPS responding on localhost:${port}`, `HTTP ${status}`);
    else fail(`Port ${port} is open, but TLS is not responding`, '', 'A plain HTTP service may exist on the HTTPS port.', 'HIGH');
  }
}

export function validateDocker() {
  try {
    const output = execSync('docker info --format "{{.ServerVersion}}"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000
    }).trim();
    ok('Docker daemon accessible', output ? `Server ${output}` : 'active');
    return true;
  } catch {
    warn('Docker is not available', 'HTTPS configuration can be reviewed, but local Canvas cannot be validated.');
    return false;
  }
}

export function applyFixes() {
  if (!state.fix) return;
  info('--fix mode', 'No automatic changes applied: URLs, certificates, and hosts require explicit review.');
}

export function validateHosts() {
  if (hostsResolves('canvas.docker')) ok('canvas.docker resolves to loopback in hosts');
  else warn('canvas.docker is not mapped to 127.0.0.1', 'Run npm run setup:hosts with explicit privileges.');
}
