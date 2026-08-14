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
  checkDocker(state);
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
  section('File structure');
  const files = [
    ['apps/client/src/main.jsx', 'React frontend entry point'],
    ['apps/server/src/server.js', 'Express Server'],
    ['apps/server/src/middlewares/AuthLTI13Handler.js', 'LTI Authentication'],
    ['apps/server/src/routes/GestorRutasAPI.js', 'API Routes'],
    ['apps/server/src/utils/logger.js', 'Structured logger'],
    ['apps/client/vite.config.js', 'Vite Configuration'],
    ['.env', 'Local environment variables']
  ];
  for (const [relativePath, description] of files) {
    const fullPath = path.join(PLUGIN_DIR, relativePath);
    if (fs.existsSync(fullPath)) ok(state, relativePath, description);
    else fail(state, `${relativePath} not found`, `Create the file: ${fullPath}`);
  }
}

function checkEnvironment(state, env) {
  section('Environment variables');
  const required = [
    ['VITE_CANVAS_BASE_URL', 'Canvas LMS base URL'],
    ['LTI_CLIENT_ID', 'LTI tool Client ID'],
    ['LTI_REDIRECT_URI', 'LTI callback URI'],
    ['GEMINI_API_KEY', 'Gemini AI API Key']
  ];
  for (const [key, description] of required) {
    const value = env[key] || process.env[key];
    if (value?.trim()) ok(state, key, `${description} configured`);
    else fail(state, `${key} not configured`, `Add ${key}=<value> in .env`);
  }
  reportLocalMode(state, env);
}

function reportLocalMode(state, env) {
  const useLocal = env.VITE_USE_LOCAL_DATA === 'true' || env.USE_LOCAL_DATA === 'true';
  const role = env.LOCAL_USER_ROLE;
  if (!useLocal) {
    warn(state, 'Local mode inactive', 'Configure VITE_USE_LOCAL_DATA=true only for testing without Canvas.');
    return;
  }
  ok(state, 'Local mode active', `Configured role: ${role || '(none)'}`);
  if (!role) warn(state, 'LOCAL_USER_ROLE not defined', 'Use admin, teacher, student or student-1..student-5.');
  else if (!['admin', 'teacher', 'student'].includes(role) && !role.startsWith('student-')) {
    warn(state, `Role '${role}' not recognized`, 'Use admin, teacher, student or student-1..student-5.');
  }
}

async function checkServices(state) {
  section('Services and ports');
  const backendRunning = await checkPort(3000);
  reportPort(state, backendRunning, 'Express Backend', ':3000', 'npm run server');
  reportPort(state, await checkPort(5173), 'Vite Frontend', ':5173', 'npm run dev');
  if (await checkPort(8080)) ok(state, 'Canvas LMS (Docker)', 'Port 8080 in use');
  else warn(state, 'Canvas LMS not detected on :8080', 'For local mode use npm start and choose option 3.');
  return backendRunning;
}

function reportPort(state, active, name, port, command) {
  if (active) ok(state, name, `Port ${port} in use`);
  else fail(state, `${name} not detected on ${port}`, `Run: ${command}`);
}

async function checkApi(state, backendRunning) {
  section('Backend API');
  if (!backendRunning) {
    warn(state, 'API not verified', 'The backend is not running.');
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
    ok(state, '/api/config/startup-mode', `Mode: ${config.mode} | DB: ${config.dbMode}`);
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

function checkDocker(state) {
  section('Docker');
  try {
    ok(state, 'Docker installed', commandOutput('docker', ['--version'], PLUGIN_DIR, 3000));
  } catch {
    warn(state, 'Docker not detected', dockerInstallGuidance());
    return;
  }
  try {
    const status = commandOutput('docker', ['compose', 'ps'], CANVAS_DIR, 5000);
    if (/running|up/i.test(status)) ok(state, 'Canvas Docker Compose', 'Active containers detected');
    else warn(state, 'Canvas Docker Compose', 'No active containers detected.');
  } catch {
    warn(state, 'Canvas Docker Compose', 'Could not query container status.');
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
