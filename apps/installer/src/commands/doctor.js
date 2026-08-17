#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(__dirname, '..', '..', '..', '..');
const CANVAS_DIR = path.resolve(PLUGIN_DIR, '..', 'canvas-lms-master');
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m'
};

export async function runDiagnosis() {
  const state = { passed: 0, warnings: 0, failures: 0 };
  printHeader();
  checkStructure(state);
  checkEnvironment(state, readEnv());
  const backendRunning = await checkServices(state);
  await checkApi(state, backendRunning);
  await checkDocker(state);
  checkNodeAndLogs(state);
  printSummary(state);
  return state.failures === 0;
}

function printHeader() {
  const line = '═'.repeat(54);
  console.log(`\n${C.bold}${C.magenta}${line}${C.reset}`);
  console.log(`${C.bold}${C.magenta}  DIAGNOSIS — Adaptive Feedback Plugin${C.reset}`);
  console.log(`${C.bold}${C.magenta}  ${new Date().toLocaleString('en-US')}${C.reset}`);
  console.log(`${C.bold}${C.magenta}${line}${C.reset}`);
}

function checkStructure(state) {
  section('Estructura de archivos');
  const files = [
    ['apps/client/src/main.jsx', 'Entrada del frontend React'],
    ['apps/server/src/server.js', 'Servidor Express'],
    ['apps/server/src/middlewares/AuthLTI13Handler.js', 'Autenticación LTI'],
    ['apps/server/src/routes/GestorRutasAPI.js', 'Rutas de API'],
    ['apps/server/src/utils/logger.js', 'Logger estructurado'],
    ['apps/client/vite.config.js', 'Vite configuration'],
    ['.env', 'Variables del entorno local']
  ];
  for (const [relativePath, description] of files) {
    const fullPath = path.join(PLUGIN_DIR, relativePath);
    if (fs.existsSync(fullPath)) ok(state, relativePath, description);
    else fail(state, `${relativePath} not found`, `Create the file: ${fullPath}`);
  }
}

function checkEnvironment(state, env) {
  section('Entorno de ejecución y variables');
  checkRootUser(state);
  const required = [
    ['VITE_CANVAS_BASE_URL', 'URL base de Canvas LMS'],
    ['LTI_CLIENT_ID', 'Client ID del tool LTI'],
    ['LTI_REDIRECT_URI', 'URI de callback LTI'],
    ['GEMINI_API_KEY', 'Clave de API de Gemini IA']
  ];
  for (const [key, description] of required) {
    const value = env[key] || process.env[key];
    if (value?.trim()) ok(state, key, `${description} configurada`);
    else fail(state, `${key} no configured`, `Add ${key}=<valor> in .env`);
  }
  reportLocalMode(state, env);
}

function checkRootUser(state) {
  const isRoot = process.getuid && process.getuid() === 0;
  if (isRoot) {
    warn(state, 'Running as root/sudo', 'It is recommended to run the diagnostic with your normal user. Using root can alter permissions and generate errors in Docker volumes.');
  } else {
    ok(state, 'User without root privileges', 'Normal execution recommended');
  }
}

function reportLocalMode(state, env) {
  const useLocal = env.VITE_USE_LOCAL_DATA === 'true' || env.USE_LOCAL_DATA === 'true';
  const role = env.LOCAL_USER_ROLE;
  if (!useLocal) {
    warn(state, 'Local mode inactive', 'Configure VITE_USE_LOCAL_DATA=true only for testing without Canvas.');
    return;
  }
  ok(state, 'Local mode active', `Role configured: ${role || '(ninguno)'}`);
  if (!role) warn(state, 'LOCAL_USER_ROLE not defined', 'Use admin, teacher, student or student-1..student-5.');
  else if (!['admin', 'teacher', 'student'].includes(role) && !role.startsWith('student-')) {
    warn(state, `Role '${role}' not recognized`, 'Use admin, teacher, student or student-1..student-5.');
  }
}

async function checkServices(state) {
  section('Services and ports');
  const backendRunning = await checkPort(3000);
  reportPort(state, backendRunning, 'Backend Express', ':3000', 'npm run server');
  reportPort(state, await checkPort(5173), 'Frontend Vite', ':5173', 'npm run dev');
  if (await checkPort(8080)) ok(state, 'Canvas LMS (Docker)', 'Port 8080 in use');
  else warn(state, 'Canvas LMS not detected on :8080', 'Para modo local usa npm start y elige opción 3.');
  return backendRunning;
}

function reportPort(state, active, name, port, command) {
  if (active) ok(state, name, `Port ${port} in use`);
  else fail(state, `${name} not detected on ${port}`, `Run: ${command}`);
}

async function checkApi(state, backendRunning) {
  section('API del backend');
  if (!backendRunning) {
    warn(state, 'API not verified', 'El backend no está corriendo.');
    return;
  }
  await reportHealth(state);
  await reportStartupMode(state);
  await reportCurrentUser(state);
}

async function reportHealth(state) {
  const response = await httpGet('https://localhost:3000/api/health');
  if (response.ok && response.status === 200) ok(state, '/api/health', 'Correct response');
  else fail(state, '/api/health failed', requestFailureDetail(response));
}

async function reportStartupMode(state) {
  const response = await httpGet('https://localhost:3000/api/config/startup-mode');
  if (!(response.ok && response.status === 200)) {
    fail(state, '/api/config/startup-mode failed', requestFailureDetail(response));
    return;
  }
  try {
    const config = JSON.parse(response.data);
    ok(state, '/api/config/startup-mode', `Modo: ${config.mode} | DB: ${config.dbMode}`);
  } catch {
    warn(state, '/api/config/startup-mode', 'Response is not valid JSON');
  }
}

async function reportCurrentUser(state) {
  const response = await httpGet('https://localhost:3000/api/config/me');
  if (response.status === 401) {
    warn(state, '/api/config/me → 401', 'Normal without LTI session or local mode.');
    return;
  }
  if (response.status !== 200) {
    fail(state, '/api/config/me failed', requestFailureDetail(response));
    return;
  }
  try {
    const user = JSON.parse(response.data);
    ok(state, '/api/config/me', `Role: ${user.role} | User: ${user.user}`);
  } catch {
    warn(state, '/api/config/me', 'Response is not valid JSON');
  }
}

async function checkDocker(state) {
  section('Docker');
  try {
    const { DockerInstaller } = await import('../installation/installers/DockerInstaller.js');
    const silentLogger = {
      info: () => {}, warn: () => {}, error: () => {}, success: () => {}, action: () => {}, plain: () => {}
    };
    const installer = new DockerInstaller(silentLogger, '/dev/null');
    const profile = await installer.getRuntimeState();

    if (profile.daemonAvailable) {
      ok(state, 'Docker', `Active daemon (${profile.backend})`);
      const { rootless, usernsRemap, hostUid } = profile.capabilities || {};
      const contextInfo = profile.context ? `Context: ${profile.context}` : 'Context: default';
      const endpointInfo = profile.contextEndpoint ? `Endpoint: ${profile.contextEndpoint}` : 'Endpoint: default';
      const isRootless = rootless ? 'Yes' : 'No';
      const isUsernsRemap = usernsRemap ? 'Yes' : 'No';
      ok(state, 'Docker Runtime', `${contextInfo} | ${endpointInfo} | Rootless: ${isRootless} | Userns-remap: ${isUsernsRemap}`);

      const isLinuxEngine = profile.backend === 'docker-engine-linux';
      const userIdStrategy = (isLinuxEngine && !rootless && !usernsRemap && hostUid > 0) ? `Injection of USER_ID=${hostUid}` : 'Image default (9999)';
      ok(state, 'USER_ID Strategy', userIdStrategy);
    } else {
      warn(state, 'Docker', 'Daemon not available or insufficient permissions.');
    }

    if (profile.composeAvailable) {
      ok(state, 'Docker Compose', 'Available');
    } else {
      warn(state, 'Docker Compose', 'Not available or error querying.');
    }

    try {
      const status = commandOutput('docker', ['compose', 'ps'], CANVAS_DIR, 5000);
      if (/running|up/i.test(status)) {
        ok(state, 'Canvas Docker Compose', 'Active containers detected');

        const { CanvasWorkspaceProbe } = await import('../installation/CanvasWorkspaceProbe.js');
        const probe = new CanvasWorkspaceProbe(silentLogger, CANVAS_DIR);
        const probeResult = await probe.runChecks();
        if (probeResult.ok) {
           ok(state, 'Workspace de Canvas', 'Correct permissions');
        } else {
           for (const err of probeResult.errors) {
             fail(state, 'Canvas permissions error', err.message);
           }
        }
      }
      else warn(state, 'Canvas Docker Compose', 'No active containers detected.');
    } catch {
      warn(state, 'Canvas Docker Compose', 'Could not query container status.');
    }
  } catch (error) {
    warn(state, 'Error querying Docker', error.message);
  }
}

function checkNodeAndLogs(state) {
  section('Node.js, dependencies and logs');
  try {
    const version = commandOutput('node', ['--version'], PLUGIN_DIR, 3000);
    const major = Number.parseInt(version.replace('v', ''), 10);
    if (major >= 20) ok(state, 'Node.js', `${version} (compatible)`);
    else warn(state, 'Node.js', `${version}; Node.js 20 or higher is required.`);
  } catch {
    fail(state, 'Node.js not found', 'Install Node.js 20 or higher.');
  }
  if (fs.existsSync(path.join(PLUGIN_DIR, 'node_modules'))) ok(state, 'node_modules', 'Dependencies installed');
  else fail(state, 'node_modules not found', 'Run npm ci.');
  reportLogs(state);
}

function reportLogs(state) {
  const logsDir = path.join(PLUGIN_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    warn(state, 'Logs directory does not exist', 'It will be created when the backend starts.');
    return;
  }
  const files = fs.readdirSync(logsDir).filter((filename) => filename.endsWith('.log'));
  if (files.length) ok(state, 'Logs directory', `${files.length} diagnostic file(s).`);
  else warn(state, 'Empty logs directory', 'Will be populated only when a relevant failure occurs.');
}

function printSummary({ passed, warnings, failures }) {
  console.log(`\n${C.bold}${'═'.repeat(54)}${C.reset}`);
  console.log(`${C.bold}  SUMMARY:${C.reset}`);
  console.log(`  ${C.green}√ Passed:${C.reset} ${passed}`);
  console.log(`  ${C.yellow}! Warnings:${C.reset} ${warnings}`);
  console.log(`  ${C.red}× Failures:${C.reset} ${failures}`);
  console.log(`${C.bold}${'═'.repeat(54)}${C.reset}`);
}

function commandOutput(command, args, cwd, timeout) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', timeout }).trim();
}

function dockerInstallGuidance() {
  return process.platform === 'linux'
    ? 'Install Docker Engine and Docker Compose V2; Docker Desktop is not mandatory on Linux.'
    : 'Install and start Docker Desktop to use local Canvas.';
}

function requestFailureDetail(response) {
  return `Status: ${response.status || 'N/A'} | Error: ${response.error || 'invalid response'}`;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port);
  });
}

function httpGet(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https://') ? https : http;
    const request = client.get(url, { rejectUnauthorized: false }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve({ ok: true, status: response.statusCode, data }));
    });
    request.on('error', (error) => resolve({ ok: false, error: error.message }));
    request.setTimeout(3000, () => {
      request.destroy();
      resolve({ ok: false, error: 'Timeout (3s)' });
    });
  });
}

function readEnv() {
  const envPath = path.join(PLUGIN_DIR, '.env');
  if (!fs.existsSync(envPath)) return {};
  const result = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const separator = line.indexOf('=');
    if (separator <= 0 || line.trim().startsWith('#')) continue;
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

function ok(state, label, detail = '') {
  state.passed += 1;
  console.log(`  ${C.green}√${C.reset} ${label}${detail ? `${C.gray} — ${detail}${C.reset}` : ''}`);
}

function warn(state, label, detail = '') {
  state.warnings += 1;
  console.log(`  ${C.yellow}!${C.reset} ${label}${detail ? `${C.gray} — ${detail}${C.reset}` : ''}`);
}

function fail(state, label, fix = '') {
  state.failures += 1;
  console.log(`  ${C.red}×${C.reset} ${C.bold}${label}${C.reset}${fix ? `\n     ${C.yellow}→ ${fix}${C.reset}` : ''}`);
}

function section(title) {
  console.log(`\n${C.cyan}${C.bold}【 ${title} 】${C.reset}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDiagnosis().then((passed) => process.exit(passed ? 0 : 1)).catch((error) => {
    console.error('Error running diagnosis:', error.message);
    process.exit(1);
  });
}
