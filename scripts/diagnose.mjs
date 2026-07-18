#!/usr/bin/env node
/**
 * Script de Diagnóstico — Plugin Feedback Adaptativo
 * Ejecutar con: node scripts/diagnose.mjs
 *
 * Verifica el estado de todos los componentes del sistema y reporta
 * problemas con sus soluciones recomendadas.
 */

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_DIR = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE REPORTE
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m'
};

let passed = 0, warnings = 0, failures = 0;

function ok(label, detail = '')  { passed++;   console.log(`  ${C.green}✅${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }
function warn(label, detail = '') { warnings++; console.log(`  ${C.yellow}⚠️ ${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }
function fail(label, fix = '')   { failures++; console.log(`  ${C.red}❌${C.reset} ${C.bold}${label}${C.reset}${fix ? '\n     ' + C.yellow + '→ ' + fix + C.reset : ''}`); }
function section(title)           { console.log(`\n${C.cyan}${C.bold}【 ${title} 】${C.reset}`); }

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICACIONES
// ─────────────────────────────────────────────────────────────────────────────

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));   // Puerto en uso
    server.once('listening', () => { server.close(); resolve(false); }); // Puerto libre
    server.listen(port);
  });
}

async function httpGet(url) {
  const useHttps = url.startsWith('https://');
  return new Promise((resolve) => {
    const client = useHttps ? https : http;
    const req = client.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: true, status: res.statusCode, data }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ ok: false, error: 'Timeout (3s)' }); });
  });
}

function readEnv() {
  const envPath = path.join(PLUGIN_DIR, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      result[trimmed.substring(0, idx)] = trimmed.substring(idx + 1).trim();
    }
  }
  return result;
}

async function runDiagnosis() {
  console.log(`\n${C.bold}${C.magenta}══════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.magenta}  DIAGNÓSTICO — Plugin Feedback Adaptativo${C.reset}`);
  console.log(`${C.bold}${C.magenta}  ${new Date().toLocaleString('es-CL')}${C.reset}`);
  console.log(`${C.bold}${C.magenta}══════════════════════════════════════════════════════${C.reset}`);

  // ── 1. ARCHIVOS Y ESTRUCTURA ───────────────────────────────────────────────
  section('Estructura de Archivos');

  const requiredFiles = [
    ['src/main.jsx', 'Entrada del frontend React'],
    ['src/server.js', 'Servidor Express'],
    ['src/middlewares/AuthLTI13Handler.js', 'Autenticación LTI'],
    ['src/rutas/GestorRutasAPI.js', 'Rutas de la API'],
    ['src/utils/logger.js', 'Logger estructurado'],
    ['src/datos/db.js', 'Módulo de base de datos'],
    ['src/servicios/infraestructura/CanvasService.local.js', 'Datos locales de Canvas'],
    ['vite.config.js', 'Configuración de Vite'],
    ['.env', 'Variables de entorno'],
  ];

  for (const [relPath, desc] of requiredFiles) {
    const fullPath = path.join(PLUGIN_DIR, relPath);
    if (fs.existsSync(fullPath)) {
      ok(relPath, desc);
    } else {
      fail(`${relPath} no encontrado`, `Crea el archivo: ${fullPath}`);
    }
  }

  // ── 2. VARIABLES DE ENTORNO ────────────────────────────────────────────────
  section('Variables de Entorno (.env)');

  const env = readEnv();

  const requiredEnv = [
    ['VITE_CANVAS_BASE_URL', 'URL base de Canvas LMS'],
    ['LTI_CLIENT_ID', 'Client ID del tool LTI'],
    ['LTI_REDIRECT_URI', 'URI de callback LTI'],
    ['GEMINI_API_KEY', 'Clave de API de Gemini IA'],
  ];

  for (const [key, desc] of requiredEnv) {
    const val = env[key] || process.env[key];
    if (val && val.trim()) {
      ok(`${key}`, `${desc} → ${val.substring(0, 40)}${val.length > 40 ? '...' : ''}`);
    } else {
      fail(`${key} no configurado`, `Agrega ${key}=<valor> en el archivo .env`);
    }
  }

  const useLocal = env.VITE_USE_LOCAL_DATA === 'true' || env.USE_LOCAL_DATA === 'true';
  const localRole = env.LOCAL_USER_ROLE;

  if (useLocal) {
    ok('Modo local activo', `Rol configurado: ${localRole || '(ninguno)'}`);
    if (!localRole) {
      warn('LOCAL_USER_ROLE no definido', 'Agrega LOCAL_USER_ROLE=admin en .env para auto-login local');
    }
    if (!['admin', 'teacher', 'student'].includes(localRole) && !localRole?.startsWith('student-')) {
      warn(`Rol '${localRole}' no reconocido`, "Use: admin, teacher, student, student-1..student-5");
    }
  } else {
    warn('Modo local inactivo', 'Si no tienes Canvas LMS corriendo, agrega VITE_USE_LOCAL_DATA=true en .env');
  }

  // ── 3. PUERTOS Y SERVICIOS ─────────────────────────────────────────────────
  section('Servicios (Puertos)');

  const backendRunning = await checkPort(3000);
  if (backendRunning) {
    ok('Backend Express', 'Puerto 3000 en uso (servidor corriendo)');
  } else {
    fail('Backend Express no detectado en :3000', 'Ejecuta: npm run server');
  }

  const frontendRunning = await checkPort(5173);
  if (frontendRunning) {
    ok('Frontend Vite', 'Puerto 5173 en uso (servidor corriendo)');
  } else {
    fail('Frontend Vite no detectado en :5173', 'Ejecuta: npm run dev');
  }

  const canvasRunning = await checkPort(8080);
  if (canvasRunning) {
    ok('Canvas LMS (Docker)', 'Puerto 8080 en uso');
  } else {
    warn('Canvas LMS no detectado en :8080', 'Si usas modo local, ejecuta: npm start → Opción 3');
  }

  // ── 4. API DEL BACKEND ─────────────────────────────────────────────────────
  section('API del Backend');

  if (backendRunning) {
    const health = await httpGet('https://localhost:3000/api/health');
    if (health.ok && health.status === 200) {
      ok('/api/health', `Respuesta: ${health.data.substring(0, 60)}`);
    } else {
      fail('/api/health falló', `Status: ${health.status || 'N/A'} | Error: ${health.error || 'Respuesta inválida'}`);
    }

    const startupMode = await httpGet('https://localhost:3000/api/config/startup-mode');
    if (startupMode.ok && startupMode.status === 200) {
      try {
        const json = JSON.parse(startupMode.data);
        ok('/api/config/startup-mode', `Modo: ${json.mode} | DB: ${json.dbMode} | Local: ${json.useLocalData}`);
      } catch {
        warn('/api/config/startup-mode', 'Respuesta no es JSON válido');
      }
    } else {
      fail('/api/config/startup-mode falló', `${startupMode.error || startupMode.status}`);
    }

    const me = await httpGet('https://localhost:3000/api/config/me');
    if (me.status === 200) {
      try {
        const json = JSON.parse(me.data);
        ok('/api/config/me', `Rol: ${json.role} | Usuario: ${json.user}`);
      } catch {
        warn('/api/config/me', 'Respuesta no parseable como JSON');
      }
    } else if (me.status === 401) {
      warn('/api/config/me → 401', 'Sesión no activa (normal si no hay token ni modo local)');
    } else {
      fail('/api/config/me falló', `${me.error || me.status}`);
    }
  } else {
    warn('API no verificada', 'El backend no está corriendo, no se pueden verificar los endpoints');
  }

  // ── 5. DOCKER ──────────────────────────────────────────────────────────────
  section('Docker');

  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf8', timeout: 3000 }).trim();
    ok('Docker instalado', dockerVersion);

    try {
      const dockerPs = execSync('docker compose ps --format json 2>nul || docker compose ps 2>nul', {
        encoding: 'utf8',
        cwd: path.join(PLUGIN_DIR, '..', 'canvas-lms-master'),
        timeout: 5000,
        shell: true
      });
      if (dockerPs.includes('running') || dockerPs.includes('Up')) {
        ok('Canvas Docker Compose', 'Contenedores activos detectados');
      } else {
        warn('Canvas Docker Compose', 'No se detectaron contenedores corriendo');
      }
    } catch {
      warn('Canvas Docker Compose', 'No se pudo verificar el estado de los contenedores');
    }
  } catch {
    warn('Docker no detectado', 'Instala Docker Desktop para usar el modo local de Canvas');
  }

  // ── 6. NODE.JS Y DEPENDENCIAS ─────────────────────────────────────────────
  section('Node.js y Dependencias');

  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const major = parseInt(nodeVersion.replace('v', ''));
    if (major >= 18) {
      ok('Node.js', `${nodeVersion} (compatible)`);
    } else {
      warn('Node.js', `${nodeVersion} — Se recomienda Node.js 18+ para compatibilidad completa`);
    }
  } catch {
    fail('Node.js no encontrado', 'Instala Node.js 18+');
  }

  const nodeModulesPath = path.join(PLUGIN_DIR, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    ok('node_modules', 'Dependencias instaladas');
  } else {
    fail('node_modules no encontrado', 'Ejecuta: npm install');
  }

  // ── 7. LOGS ────────────────────────────────────────────────────────────────
  section('Archivos de Log');

  const logsDir = path.join(PLUGIN_DIR, 'logs');
  if (fs.existsSync(logsDir)) {
    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    if (logFiles.length > 0) {
      ok('Directorio de logs', `${logFiles.length} archivo(s): ${logFiles.slice(-3).join(', ')}`);
    } else {
      warn('Directorio de logs vacío', 'Los logs se crearán cuando el backend arranque');
    }
  } else {
    warn('Directorio de logs no existe', 'Se creará automáticamente al arrancar el backend');
  }

  // ── RESUMEN FINAL ──────────────────────────────────────────────────────────
  console.log(`\n${C.bold}══════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  RESUMEN:${C.reset}`);
  console.log(`  ${C.green}✅ Exitoso:${C.reset}  ${passed}`);
  console.log(`  ${C.yellow}⚠️  Avisos:${C.reset}   ${warnings}`);
  console.log(`  ${C.red}❌ Errores:${C.reset}  ${failures}`);
  console.log(`${C.bold}══════════════════════════════════════════════════════${C.reset}`);

  if (failures === 0 && warnings === 0) {
    console.log(`\n${C.green}${C.bold}🎉 ¡El sistema está en perfecto estado!${C.reset}\n`);
  } else if (failures === 0) {
    console.log(`\n${C.yellow}${C.bold}⚠️  Sistema funcional con avisos menores.${C.reset}\n`);
  } else {
    console.log(`\n${C.red}${C.bold}🚨 Se encontraron ${failures} error(es) que requieren atención.${C.reset}`);
    console.log(`${C.gray}   Revisa las sugerencias de corrección (→) arriba.${C.reset}\n`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

runDiagnosis().catch((e) => {
  console.error('Error ejecutando diagnóstico:', e.message);
  process.exit(1);
});
