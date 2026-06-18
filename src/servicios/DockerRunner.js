import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CANVAS_PATH = path.resolve(__dirname, '../../../canvas-lms-master');

const LOGS_DIR = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const DOCKER_LOG_FILE = path.join(LOGS_DIR, 'docker_canvas.log');

export function writeDockerLog(prefix, data) {
  const text = data.toString();
  const timestamp = new Date().toISOString();
  fs.appendFileSync(DOCKER_LOG_FILE, `[${timestamp}] ${prefix}: ${text}`);
}

export function startSpinner(label) {
  const isWindows = process.platform === 'win32';
  const frames = isWindows 
    ? ['-', '\\', '|', '/'] 
    : ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let x = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  [⏳] ${label} (esto puede tardar unos minutos) ${frames[x]}`);
    x = (x + 1) % frames.length;
  }, 100);
  return {
    stop: () => {
      clearInterval(interval);
      process.stdout.write('\r'.padEnd(80, ' ') + '\r');
    }
  };
}

class DockerRunner {
  static checkDocker() {
    try {
      execSync('docker info', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  static startCanvas() {
    return new Promise((resolve, reject) => {
      console.log('[DockerRunner] Verificando Docker Desktop...');
      if (!this.checkDocker()) {
        console.error('[DockerRunner] ERROR: Docker no está en ejecución.');
        console.error('Por favor, asegúrate de iniciar "Docker Desktop" y de que WSL2 esté activo antes de continuar.');
        return reject(new Error('Docker no está en ejecución.'));
      }

      console.log(`[DockerRunner] Levantando contenedores Canvas en segundo plano. Los detalles se guardan en logs/docker_canvas.log...`);
      
      const dockerProcess = spawn('docker', ['compose', 'up', '-d'], {
        cwd: CANVAS_PATH
      });

      dockerProcess.stdout.on('data', (data) => writeDockerLog('[Docker-Stdout]', data));
      dockerProcess.stderr.on('data', (data) => writeDockerLog('[Docker-Stderr]', data));

      dockerProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[DockerRunner] Comando docker compose up -d ejecutado con éxito.');
          resolve(true);
        } else {
          console.error(`[DockerRunner] El proceso de Docker terminó con código de error ${code}.`);
          reject(new Error(`docker compose falló con código ${code}`));
        }
      });

      dockerProcess.on('error', (err) => {
        console.error('[DockerRunner] Error al intentar iniciar docker compose:', err.message);
        reject(err);
      });
    });
  }

  static runDockerCommand(args, label) {
    return new Promise((resolve, reject) => {
      console.log(`\n[DockerRunner] Preparando: ${label}... (Logs en logs/docker_canvas.log)`);
      
      const dockerProcess = spawn('docker', args, {
        cwd: CANVAS_PATH
      });

      const spinner = startSpinner(`Ejecutando ${label}`);

      dockerProcess.stdout.on('data', (data) => writeDockerLog(`[${label}-Stdout]`, data));
      dockerProcess.stderr.on('data', (data) => writeDockerLog(`[${label}-Stderr]`, data));

      dockerProcess.on('close', (code) => {
        spinner.stop();
        if (code === 0) {
          console.log(`[DockerRunner] ✅ Éxito: ${label} completado.`);
          resolve(true);
        } else {
          console.error(`[DockerRunner] ❌ Error: ${label} falló con código ${code}.`);
          reject(new Error(`${label} falló`));
        }
      });

      dockerProcess.on('error', (err) => {
        spinner.stop();
        console.error(`[DockerRunner] ❌ Error ejecutando ${label}:`, err.message);
        reject(err);
      });
    });
  }

  static isCanvasRunning() {
    try {
      const output = execSync('docker compose ps --services --filter "status=running"', { cwd: CANVAS_PATH, encoding: 'utf8' });
      return output.includes('web');
    } catch (e) {
      return false;
    }
  }

  static isCanvasInitialized() {
    try {
      const output = execSync(
        `docker compose exec -T postgres psql -U canvas -d canvas_development -tAc "SELECT EXISTS(SELECT 1 FROM developer_keys WHERE name='Plugin Feedback LTI');"`,
        { cwd: CANVAS_PATH, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }
      );
      return output.trim() === 't';
    } catch (e) {
      return false;
    }
  }
}

export default DockerRunner;
