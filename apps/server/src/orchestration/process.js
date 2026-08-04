import spawn from 'cross-spawn';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_DIR = path.resolve(path.dirname(__filename), '..', '..', '..', '..');
const VITE_PORT = 5173;
const SERVER_PORT = 3000;

export function spawnVite() {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: PLUGIN_DIR,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

export function spawnBackend() {
  const child = spawn('node', ['apps/server/src/server.js'], {
    cwd: PLUGIN_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
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
  return new Promise((resolve) => {
    if (!backend || backend.killed) {
      return resolve();
    }
    const onExit = () => {
      backend.removeListener('error', onError);
      resolve();
    };
    const onError = () => {
      backend.removeListener('exit', onExit);
      resolve();
    };
    backend.once('exit', onExit);
    backend.once('error', onError);
    backend.kill('SIGINT');
  });
}

export function waitForBackend(backend) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      backend.removeListener('error', onError);
      backend.removeListener('exit', onExit);
      if (backend.stdout) backend.stdout.removeListener('data', onData);
      clearTimeout(timer);
      fn();
    };
    const onError = (err) => finish(() => reject(err));
    const onExit = (code) => finish(() => {
      if (code !== 0 && code !== null) reject(new Error(`Backend cerrado con código ${code}`));
      else resolve();
    });
    const onData = (data) => {
      if (data.toString().includes('BACKEND INICIADO')) {
        finish(resolve);
      }
    };
    
    backend.on('error', onError);
    backend.on('exit', onExit);
    if (backend.stdout) backend.stdout.on('data', onData);
    
    // 120s: Dar tiempo suficiente para el prompt de Admin de mkcert en Windows
    const timer = setTimeout(() => finish(resolve), 120000); 
  });
}

export { VITE_PORT, SERVER_PORT };
