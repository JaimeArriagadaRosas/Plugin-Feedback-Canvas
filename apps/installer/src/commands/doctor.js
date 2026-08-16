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
  console.log(`${C.bold}${C.magenta}  DIAGNÓSTICO — Plugin Feedback Adaptativo${C.reset}`);
  console.log(`${C.bold}${C.magenta}  ${new Date().toLocaleString('es-CL')}${C.reset}`);
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
    ['apps/client/vite.config.js', 'Configuración de Vite'],
    ['.env', 'Variables del entorno local']
  ];
  for (const [relativePath, description] of files) {
    const fullPath = path.join(PLUGIN_DIR, relativePath);
    if (fs.existsSync(fullPath)) ok(state, relativePath, description);
    else fail(state, `${relativePath} no encontrado`, `Crea el archivo: ${fullPath}`);
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
    else fail(state, `${key} no configurado`, `Agrega ${key}=<valor> en .env`);
  }
  reportLocalMode(state, env);
}

function checkRootUser(state) {
  const isRoot = process.getuid && process.getuid() === 0;
  if (isRoot) {
    warn(state, 'Ejecutando como root/sudo', 'Se recomienda ejecutar el diagnóstico con tu usuario normal. Usar root puede alterar permisos y generar errores en los volúmenes de Docker.');
  } else {
    ok(state, 'Usuario sin privilegios root', 'Ejecución normal recomendada');
  }
}

function reportLocalMode(state, env) {
  const useLocal = env.VITE_USE_LOCAL_DATA === 'true' || env.USE_LOCAL_DATA === 'true';
  const role = env.LOCAL_USER_ROLE;
  if (!useLocal) {
    warn(state, 'Modo local inactivo', 'Configura VITE_USE_LOCAL_DATA=true solo para pruebas sin Canvas.');
    return;
  }
  ok(state, 'Modo local activo', `Rol configurado: ${role || '(ninguno)'}`);
  if (!role) warn(state, 'LOCAL_USER_ROLE no definido', 'Usa admin, teacher, student o student-1..student-5.');
  else if (!['admin', 'teacher', 'student'].includes(role) && !role.startsWith('student-')) {
    warn(state, `Rol '${role}' no reconocido`, 'Usa admin, teacher, student o student-1..student-5.');
  }
}

async function checkServices(state) {
  section('Servicios y puertos');
  const backendRunning = await checkPort(3000);
  reportPort(state, backendRunning, 'Backend Express', ':3000', 'npm run server');
  reportPort(state, await checkPort(5173), 'Frontend Vite', ':5173', 'npm run dev');
  if (await checkPort(8080)) ok(state, 'Canvas LMS (Docker)', 'Puerto 8080 en uso');
  else warn(state, 'Canvas LMS no detectado en :8080', 'Para modo local usa npm start y elige opción 3.');
  return backendRunning;
}

function reportPort(state, active, name, port, command) {
  if (active) ok(state, name, `Puerto ${port} en uso`);
  else fail(state, `${name} no detectado en ${port}`, `Ejecuta: ${command}`);
}

async function checkApi(state, backendRunning) {
  section('API del backend');
  if (!backendRunning) {
    warn(state, 'API no verificada', 'El backend no está corriendo.');
    return;
  }
  await reportHealth(state);
  await reportStartupMode(state);
  await reportCurrentUser(state);
}

async function reportHealth(state) {
  const response = await httpGet('https://localhost:3000/api/health');
  if (response.ok && response.status === 200) ok(state, '/api/health', 'Respuesta correcta');
  else fail(state, '/api/health falló', requestFailureDetail(response));
}

async function reportStartupMode(state) {
  const response = await httpGet('https://localhost:3000/api/config/startup-mode');
  if (!(response.ok && response.status === 200)) {
    fail(state, '/api/config/startup-mode falló', requestFailureDetail(response));
    return;
  }
  try {
    const config = JSON.parse(response.data);
    ok(state, '/api/config/startup-mode', `Modo: ${config.mode} | DB: ${config.dbMode}`);
  } catch {
    warn(state, '/api/config/startup-mode', 'Respuesta no es JSON válido');
  }
}

async function reportCurrentUser(state) {
  const response = await httpGet('https://localhost:3000/api/config/me');
  if (response.status === 401) {
    warn(state, '/api/config/me → 401', 'Normal sin sesión LTI ni modo local.');
    return;
  }
  if (response.status !== 200) {
    fail(state, '/api/config/me falló', requestFailureDetail(response));
    return;
  }
  try {
    const user = JSON.parse(response.data);
    ok(state, '/api/config/me', `Rol: ${user.role} | Usuario: ${user.user}`);
  } catch {
    warn(state, '/api/config/me', 'Respuesta no es JSON válido');
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
      ok(state, 'Docker', `Daemon activo (${profile.backend})`);
      const { rootless, usernsRemap, hostUid } = profile.capabilities || {};
      const contextInfo = profile.context ? `Contexto: ${profile.context}` : 'Contexto: default';
      const endpointInfo = profile.contextEndpoint ? `Endpoint: ${profile.contextEndpoint}` : 'Endpoint: default';
      const isRootless = rootless ? 'Sí' : 'No';
      const isUsernsRemap = usernsRemap ? 'Sí' : 'No';
      ok(state, 'Docker Runtime', `${contextInfo} | ${endpointInfo} | Rootless: ${isRootless} | Userns-remap: ${isUsernsRemap}`);
      
      const isLinuxEngine = profile.backend === 'docker-engine-linux';
      const userIdStrategy = (isLinuxEngine && !rootless && !usernsRemap && hostUid > 0) ? `Inyección de USER_ID=${hostUid}` : 'Predeterminado de imagen (9999)';
      ok(state, 'USER_ID Strategy', userIdStrategy);
    } else {
      warn(state, 'Docker', 'Daemon no disponible o permisos insuficientes.');
    }

    if (profile.composeAvailable) {
      ok(state, 'Docker Compose', 'Disponible');
    } else {
      warn(state, 'Docker Compose', 'No disponible o error al consultar.');
    }

    try {
      const status = commandOutput('docker', ['compose', 'ps'], CANVAS_DIR, 5000);
      if (/running|up/i.test(status)) {
        ok(state, 'Canvas Docker Compose', 'Contenedores activos detectados');
        
        const { CanvasWorkspaceProbe } = await import('../installation/CanvasWorkspaceProbe.js');
        const probe = new CanvasWorkspaceProbe(silentLogger, CANVAS_DIR);
        const probeResult = await probe.runChecks();
        if (probeResult.ok) {
           ok(state, 'Workspace de Canvas', 'Permisos correctos');
        } else {
           for (const err of probeResult.errors) {
             fail(state, 'Error de permisos de Canvas', err.message);
           }
        }
      }
      else warn(state, 'Canvas Docker Compose', 'No se detectaron contenedores activos.');
    } catch {
      warn(state, 'Canvas Docker Compose', 'No se pudo consultar el estado de los contenedores.');
    }
  } catch (error) {
    warn(state, 'Error consultando Docker', error.message);
  }
}

function checkNodeAndLogs(state) {
  section('Node.js, dependencias y logs');
  try {
    const version = commandOutput('node', ['--version'], PLUGIN_DIR, 3000);
    const major = Number.parseInt(version.replace('v', ''), 10);
    if (major >= 20) ok(state, 'Node.js', `${version} (compatible)`);
    else warn(state, 'Node.js', `${version}; se requiere Node.js 20 o superior.`);
  } catch {
    fail(state, 'Node.js no encontrado', 'Instala Node.js 20 o superior.');
  }
  if (fs.existsSync(path.join(PLUGIN_DIR, 'node_modules'))) ok(state, 'node_modules', 'Dependencias instaladas');
  else fail(state, 'node_modules no encontrado', 'Ejecuta npm ci.');
  reportLogs(state);
}

function reportLogs(state) {
  const logsDir = path.join(PLUGIN_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    warn(state, 'Directorio de logs no existe', 'Se creará al arrancar el backend.');
    return;
  }
  const files = fs.readdirSync(logsDir).filter((filename) => filename.endsWith('.log'));
  if (files.length) ok(state, 'Directorio de logs', `${files.length} archivo(s) de diagnóstico.`);
  else warn(state, 'Directorio de logs vacío', 'Se poblará solo cuando ocurra un fallo relevante.');
}

function printSummary({ passed, warnings, failures }) {
  console.log(`\n${C.bold}${'═'.repeat(54)}${C.reset}`);
  console.log(`${C.bold}  RESUMEN:${C.reset}`);
  console.log(`  ${C.green}√ Correcto:${C.reset} ${passed}`);
  console.log(`  ${C.yellow}! Avisos:${C.reset} ${warnings}`);
  console.log(`  ${C.red}× Errores:${C.reset} ${failures}`);
  console.log(`${C.bold}${'═'.repeat(54)}${C.reset}`);
}

function commandOutput(command, args, cwd, timeout) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', timeout }).trim();
}

function dockerInstallGuidance() {
  return process.platform === 'linux'
    ? 'Instala Docker Engine y Docker Compose V2; Docker Desktop no es obligatorio en Linux.'
    : 'Instala e inicia Docker Desktop para usar Canvas local.';
}

function requestFailureDetail(response) {
  return `Estado: ${response.status || 'N/A'} | Error: ${response.error || 'respuesta inválida'}`;
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
    console.error('Error ejecutando diagnóstico:', error.message);
    process.exit(1);
  });
}
