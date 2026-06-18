import { spawn, execSync } from 'node:child_process';
import * as readline from 'node:readline';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';
import * as net from 'node:net';
import * as http from 'node:http';

import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_DIR = path.resolve(path.dirname(__filename), '..');
const INSTALL_DIR = path.resolve(PLUGIN_DIR, 'src', 'instalación');
const PYTHON_SCRIPT = path.resolve(INSTALL_DIR, 'verificar_entorno.py');
const VITE_PORT = 5173;
const SERVER_PORT = 3000;
const CANVAS_DIR = path.resolve(PLUGIN_DIR, '..', 'canvas-lms-master');

function getEnvVar(key) {
  const envPath = path.resolve(PLUGIN_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function log(...args) { console.log('[run]', ...args); }
function error(...args) { console.error('[run]', ...args); }

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function killProcessOnPort(port) {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      try {
        const stdout = execSync(`netstat -aon | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', shell: true });
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            log(`Terminando proceso PID ${pid} en puerto ${port}`);
            execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8', shell: true });
          }
        }
      } catch { /* puerto libre */ }
    } else {
      try {
        const stdout = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
        const pids = stdout.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          log(`Terminando proceso PID ${pid} en puerto ${port}`);
          process.kill(parseInt(pid, 10), 'SIGTERM');
        }
      } catch { /* puerto libre */ }
    }
  } catch (e) {
    error(`No se pudo liberar puerto ${port}: ${e.message}`);
  }
}

async function clearPorts() {
  log(`Limpiando procesos previos en puertos ${VITE_PORT} y ${SERVER_PORT}...`);
  if (await isPortInUse(VITE_PORT)) killProcessOnPort(VITE_PORT);
  if (await isPortInUse(SERVER_PORT)) killProcessOnPort(SERVER_PORT);
  log('Puertos liberados.');
}

function ask(question, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : '';
    rl.question(question + suffix + ': ', (answer) => {
      rl.close();
      resolve(answer.trim() || (defaultValue !== undefined ? String(defaultValue) : ''));
    });
  });
}

async function showMainMenu() {
  console.log('\n=========================================================');
  console.log('  SELECCIONE EL MODO DE INICIO DEL SERVIDOR');
  console.log('=========================================================');
  console.log('  [1] Conexion LTI 1.3 (Flujo Real de Autenticacion Canvas)');
  console.log('  [2] Conexion por API (Ingreso manual de Token Canvas)');
  console.log('  [3] Ejecutar localmente Canvas LMS (Open Source)');
  console.log('=========================================================');
  const mode = await ask('Seleccione una opcion (1-3)', '3');
  return mode;
}

async function showRoleMenu() {
  console.log('\n=========================================================');
  console.log('  SELECCIONE EL ROL PARA INGRESAR');
  console.log('=========================================================');
  console.log('  [1] Administrador');
  console.log('  [2] Profesor');
  console.log('  [3] Estudiante');
  console.log('=========================================================');
  const role = await ask('Seleccione una opcion (1-3)', '1');
  
  if (role === '3') {
    console.log('\n=========================================================');
    console.log('  SELECCIONE EL PERFIL DE ESTUDIANTE');
    console.log('=========================================================');
    console.log('  [1] Juan Pérez (Estudiante promedio)');
    console.log('  [2] María García (Estudiante sobresaliente)');
    console.log('  [3] Pedro López (Estudiante en riesgo)');
    console.log('  [4] Ana Torres (Estudiante promedio alto)');
    console.log('  [5] Carlos Méndez (Estudiante de excelencia)');
    console.log('=========================================================');
    const studentIdx = await ask('Seleccione una opcion (1-5)', '1');
    return `student-${studentIdx}`;
  }
  
  return role;
}

async function runPythonVerify() {
  return new Promise((resolve, reject) => {
    log('Verificando componentes del entorno (Python)...');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(pythonCmd, [`"${PYTHON_SCRIPT}"`], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`Script de verificacion termino con codigo ${code}`));
    });
  });
}

function writeEnvOverrides(role, mode) {
  const envPath = path.resolve(PLUGIN_DIR, '.env');
  let env = '';
  if (fs.existsSync(envPath)) env = fs.readFileSync(envPath, 'utf8');
  const lines = env.split('\n').filter(l => !l.startsWith('MOCK_USER_ROLE=') && !l.startsWith('LOCAL_USER_ROLE=') && !l.startsWith('VITE_USE_MOCK_DATA=') && !l.startsWith('VITE_USE_LOCAL_DATA=') && !l.startsWith('STARTUP_MODE=') && !l.startsWith('NON_INTERACTIVE='));
  lines.push(`STARTUP_MODE=${mode}`);
  lines.push('NON_INTERACTIVE=true');
  lines.push('VITE_USE_LOCAL_DATA=true');
  lines.push(`LOCAL_USER_ROLE=${role}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
  log(`Variables de entorno configuradas (modo: ${mode}, rol: ${role}).`);
}

function spawnVite() {
  log('Starting Frontend (Vite) in background...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd: PLUGIN_DIR,
    shell: process.platform === 'win32',
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

function spawnBackend() {
  log('Starting Backend (Express)...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['run', 'server'], {
    cwd: PLUGIN_DIR,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  return child;
}

async function openBrowser(url) {
  const platform = os.platform();
  let command;
  if (platform === 'win32') command = `start "" "${url}"`;
  else if (platform === 'darwin') command = `open "${url}"`;
  else command = `xdg-open "${url}"`;
  try { execSync(command, { shell: true }); } catch { /* ignorar */ }
}

async function waitForCanvasReady(timeoutMs = 30 * 60 * 1000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    function poll() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Timeout esperando a Canvas LMS.'));
      }

      const req = http.get('http://localhost:3000/api/config/startup-mode', (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.initializing === false) {
              resolve();
            } else {
              setTimeout(poll, 3000);
            }
          } catch {
            setTimeout(poll, 3000);
          }
        });
      });
      req.on('error', () => setTimeout(poll, 3000));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(poll, 3000); });
    }

    // Espera 2s antes del primer intento (el backend aún puede estar arrancando)
    setTimeout(poll, 2000);
  });
}

async function main() {
  try {
    await clearPorts();

    const mode = await showMainMenu();

    let role = 'admin';
    if (mode === '3') {
      try {
        await runPythonVerify();
      } catch (e) {
        error(e.message);
        await ask('Presione Enter para salir...');
        process.exit(1);
      }
      const roleOpt = await showRoleMenu();
      role = roleOpt === '1' ? 'admin' : roleOpt === '2' ? 'teacher' : roleOpt;
      writeEnvOverrides(role, '3');
      
      if (role.startsWith('student-')) {
        const studentIndex = role.split('-')[1];
        const studentsInfo = {
          '1': { name: 'Juan Pérez', email: 'estudiante1@canvas.local', pass: 'estudiante1pass' },
          '2': { name: 'María García', email: 'estudiante2@canvas.local', pass: 'estudiante2pass' },
          '3': { name: 'Pedro López', email: 'estudiante3@canvas.local', pass: 'estudiante3pass' },
          '4': { name: 'Ana Torres', email: 'estudiante4@canvas.local', pass: 'estudiante4pass' },
          '5': { name: 'Carlos Méndez', email: 'estudiante5@canvas.local', pass: 'estudiante5pass' }
        };
        const student = studentsInfo[studentIndex] || studentsInfo['1'];
        console.log('\n=========================================================');
        console.log(`  INICIANDO CON ROL LOCAL ESTUDIANTE: ${student.name}`);
        console.log('=========================================================');
        console.log(`  Email Canvas:    ${student.email}`);
        console.log(`  Password Canvas: ${student.pass}`);
        console.log('=========================================================');
        console.log('  Inicia sesión con estas credenciales en el navegador.');
        console.log('=========================================================\n');
      } else if (role === 'teacher') {
        console.log('\n=========================================================');
        console.log(`  INICIANDO CON ROL LOCAL PROFESOR`);
        console.log('=========================================================');
        console.log(`  Email Canvas:    profesor@canvas.local`);
        console.log(`  Password Canvas: teacherpassword123`);
        console.log('=========================================================');
        console.log('  Inicia sesión con estas credenciales en el navegador.');
        console.log('=========================================================\n');
      } else if (role === 'admin') {
        console.log('\n=========================================================');
        console.log(`  INICIANDO CON ROL LOCAL ADMINISTRADOR`);
        console.log('=========================================================');
        console.log(`  Email Canvas:    admin@canvas.local`);
        console.log(`  Password Canvas: adminpassword123`);
        console.log('=========================================================');
        console.log('  Inicia sesión con estas credenciales en el navegador.');
        console.log('=========================================================\n');
      } else {
        log('Abriendo Frontend del Plugin en el navegador...');
        await openBrowser('http://localhost:5173/');
      }
    } else {
      process.env.STARTUP_MODE = mode;
      process.env.NON_INTERACTIVE = 'true';
      if (mode === '2') {
        process.env.VITE_USE_LOCAL_DATA = 'false';
        log('Abriendo Frontend del Plugin en el navegador...');
        await openBrowser('http://localhost:5173/');
      } else {
        process.env.VITE_USE_LOCAL_DATA = 'true';
        const roleOpt = await showRoleMenu();
        role = roleOpt === '1' ? 'admin' : roleOpt === '2' ? 'teacher' : roleOpt;
        writeEnvOverrides(role, mode);
        
        if (role.startsWith('student-')) {
          const studentIndex = role.split('-')[1];
          const studentsInfo = {
            '1': { name: 'Juan Pérez', email: 'estudiante1@canvas.local', pass: 'estudiante1pass' },
            '2': { name: 'María García', email: 'estudiante2@canvas.local', pass: 'estudiante2pass' },
            '3': { name: 'Pedro López', email: 'estudiante3@canvas.local', pass: 'estudiante3pass' },
            '4': { name: 'Ana Torres', email: 'estudiante4@canvas.local', pass: 'estudiante4pass' },
            '5': { name: 'Carlos Méndez', email: 'estudiante5@canvas.local', pass: 'estudiante5pass' }
          };
          const student = studentsInfo[studentIndex] || studentsInfo['1'];
          console.log('\n=========================================================');
          console.log(`  INICIANDO CON ROL LOCAL ESTUDIANTE: ${student.name}`);
          console.log('=========================================================');
          console.log(`  Email Canvas:    ${student.email}`);
          console.log(`  Password Canvas: ${student.pass}`);
          console.log('=========================================================');
        } else {
          log('Abriendo Frontend del Plugin en el navegador...');
          await openBrowser('http://localhost:5173/');
        }
      }
    }

    const backend = spawnBackend();
    await new Promise(r => setTimeout(r, 2000));
    spawnVite();

    if (mode === '3' && (role.startsWith('student-') || role === 'teacher' || role === 'admin')) {
      const courseId = getEnvVar('VITE_CANVAS_COURSE_ID') || '1';
      log('Canvas LMS se está inicializando en segundo plano. El navegador se abrirá automáticamente cuando esté listo...');
      waitForCanvasReady().then(() => {
        const targetUrl = role.startsWith('student-') 
          ? `http://localhost:8080/courses/${courseId}/grades` 
          : `http://localhost:8080/courses/${courseId}`;
          
        log(`✅ Canvas LMS listo. Abriendo ${targetUrl} ...`);
        openBrowser(targetUrl);
      }).catch(err => {
        error('No se pudo detectar que Canvas estuviese listo:', err.message);
        log(`Intenta abrir manualmente: http://localhost:8080/`);
      });
    }
    
    // Mantener la consola abierta escuchando señales o un Enter manual si falla o se detiene.
    backend.on('close', async (code) => {
      console.log(`\n[run] El servidor backend se ha cerrado con código: ${code}`);
      await ask('Presione Enter para salir...');
      process.exit(code ?? 0);
    });

  } catch (e) {
    error(e.message);
    await ask('Presione Enter para salir...');
    process.exit(1);
  }
}

main();
