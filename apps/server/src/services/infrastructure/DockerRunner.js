import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginDirectory = path.resolve(__dirname, '../../../../../');
export const CANVAS_PATH = process.env.CANVAS_LMS_DIR || path.resolve(pluginDirectory, '..', 'canvas-lms-master');

const LOGS_DIR = path.resolve(__dirname, '../../logs');
// eslint-disable-next-line security/detect-non-literal-fs-filename
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const DOCKER_LOG_FILE = path.join(LOGS_DIR, 'docker_canvas.log');

export function writeDockerLog(prefix, data) {
  const text = data.toString();
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.appendFileSync(DOCKER_LOG_FILE, `[${timestamp}] ${prefix}: ${text}`);
}

export function startSpinner(label) {
  const isWindows = process.platform === 'win32';
  const frames = isWindows 
    ? ['-', '\\', '|', '/'] 
    : ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let x = 0;
  const interval = setInterval(() => {
    // eslint-disable-next-line security/detect-object-injection
    process.stdout.write(`\r  [⏳] ${label} (this may take a few minutes) ${frames[x]}`);
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
      console.log('[DockerRunner] Checking Docker runtime...');
      if (!this.checkDocker()) {
        console.error('[DockerRunner] ERROR: Docker is not running.');
        console.error('Start the configured Docker runtime for this environment and try again.');
        return reject(new Error('Docker is not running.'));
      }

      console.log(`[DockerRunner] Starting Canvas containers in the background. Details are saved in logs/docker_canvas.log...`);
      
      const dockerProcess = spawn('docker', ['compose', 'up', '-d'], {
        cwd: CANVAS_PATH
      });

      dockerProcess.stdout.on('data', (data) => writeDockerLog('[Docker-Stdout]', data));
      dockerProcess.stderr.on('data', (data) => writeDockerLog('[Docker-Stderr]', data));

      dockerProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[DockerRunner] Command docker compose up -d executed successfully.');
          resolve(true);
        } else {
          console.error(`[DockerRunner] The Docker process ended with error code ${code}.`);
          reject(new Error(`docker compose failed with code ${code}`));
        }
      });

      dockerProcess.on('error', (err) => {
        console.error('[DockerRunner] Error attempting to start docker compose:', err.message);
        reject(err);
      });
    });
  }

  static runDockerCommand(args, label) {
    return new Promise((resolve, reject) => {
      console.log(`\n[DockerRunner] Preparing: ${label}... (Logs in logs/docker_canvas.log)`);
      
      const dockerProcess = spawn('docker', args, {
        cwd: CANVAS_PATH
      });

      const spinner = startSpinner(`Executing ${label}`);

      dockerProcess.stdout.on('data', (data) => writeDockerLog(`[${label}-Stdout]`, data));
      dockerProcess.stderr.on('data', (data) => writeDockerLog(`[${label}-Stderr]`, data));

      dockerProcess.on('close', (code) => {
        spinner.stop();
        if (code === 0) {
          console.log(`[DockerRunner] ✅ Success: ${label} completed.`);
          resolve(true);
        } else {
          console.error(`[DockerRunner] ❌ Error: ${label} failed with code ${code}.`);
          reject(new Error(`${label} failed`));
        }
      });

      dockerProcess.on('error', (err) => {
        spinner.stop();
        console.error(`[DockerRunner] ❌ Error executing ${label}:`, err.message);
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
