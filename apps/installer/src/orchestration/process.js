import spawn from 'cross-spawn';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_DIR = path.resolve(path.dirname(__filename), '..', '..', '..', '..');
const VITE_PORT = 5173;
const SERVER_PORT = 3000;
let viteProcess = null;

export function spawnVite() {
  viteProcess = spawn('npm', ['run', 'dev'], {
    cwd: PLUGIN_DIR,
    stdio: 'ignore'
  });
  viteProcess.once('exit', () => { viteProcess = null; });
  return viteProcess;
}

export function stopVite() {
  return stopChild(viteProcess);
}

export function spawnBackend() {
  const child = spawn('node', ['apps/server/src/server.js'], {
    cwd: PLUGIN_DIR,
    // Abrimos canal IPC explícitamente para comunicación estricta
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  const writeWithSpinner = (stream, data) => {
    if (global.canvasSpinner) global.canvasSpinner.clear();
    stream.write(data);
    if (global.canvasSpinner) global.canvasSpinner.start();
  };

  if (child.stdout) {
    child.stdout.on('data', (data) => writeWithSpinner(process.stdout, data));
  }
  if (child.stderr) {
    child.stderr.on('data', (data) => writeWithSpinner(process.stderr, data));
  }

  return child;
}

export function stopBackend(backend) {
  return stopChild(backend);
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      return resolve();
    }
    const onExit = () => {
      child.removeListener('error', onError);
      resolve();
    };
    const onError = () => {
      child.removeListener('exit', onExit);
      resolve();
    };
    child.once('exit', onExit);
    child.once('error', onError);
    child.kill('SIGINT');
  });
}

export function waitForBackend(backend) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let backendStarted = false; // Flag crucial para saber si llegó al evento ready

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      backend.removeListener('error', onError);
      backend.removeListener('exit', onExit);
      backend.removeListener('message', onMessage);
      clearTimeout(timer);
      fn();
    };

    const onError = (err) => finish(() => reject(err));
    
    const onExit = (code) => finish(() => {
      if (!backendStarted) {
        reject(new Error(`El backend se cerró prematuramente antes de iniciar (código de salida: ${code})`));
      } else if (code !== 0 && code !== null) {
        reject(new Error(`Backend cerrado inesperadamente con código ${code}`));
      } else {
        resolve();
      }
    });

    const onMessage = (msg) => {
      if (msg && msg.type === 'server-ready') {
        backendStarted = true;
        finish(resolve);
      } else if (msg && msg.type === 'server-error') {
        finish(() => reject(new Error(`Error reportado por el backend vía IPC: ${msg.message}`)));
      }
    };
    
    backend.on('error', onError);
    backend.on('exit', onExit);
    backend.on('message', onMessage);
    
    // 120s: Dar tiempo suficiente para el prompt de Admin de mkcert en Windows
    const timer = setTimeout(() => {
      if (!backendStarted) {
        finish(() => reject(new Error('Timeout de 120s esperando a que el backend reporte estado "server-ready" vía IPC.')));
      }
    }, 120000); 
  });
}

export { VITE_PORT, SERVER_PORT };
