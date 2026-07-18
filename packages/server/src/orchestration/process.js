import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_DIR = path.resolve(path.dirname(__filename), '..', '..', '..', '..');
const VITE_PORT = 5173;
const SERVER_PORT = 3000;

export function spawnVite() {
  const isWin = process.platform === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  const shell = isWin ? (process.env.ComSpec || 'cmd.exe') : false;
  // Con shell activado, pasar args como array dispara DEP0190 (Node no los
  // escapa, solo los concatena). Los args aquí son constantes y controlados,
  // así que componemos el comando completo como string para evitar el warning.
  const command = shell ? `${npmCmd} run dev` : npmCmd;
  const args = shell ? [] : ['run', 'dev'];
  const child = spawn(command, args, {
    cwd: PLUGIN_DIR,
    detached: true,
    shell,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

export function spawnBackend() {
  const isWin = process.platform === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  const shell = isWin ? (process.env.ComSpec || 'cmd.exe') : false;
  const command = shell ? `${npmCmd} run server` : npmCmd;
  const args = shell ? [] : ['run', 'server'];
  const child = spawn(command, args, {
    cwd: PLUGIN_DIR,
    shell,
    stdio: 'inherit',
  });
  return child;
}

export { VITE_PORT, SERVER_PORT };
