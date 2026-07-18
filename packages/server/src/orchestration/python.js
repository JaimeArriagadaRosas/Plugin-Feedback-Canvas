import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_DIR = path.resolve(path.dirname(__filename), '..', '..');
const PYTHON_SCRIPT = path.resolve(PLUGIN_DIR, 'src', 'setup', 'verificar_entorno.py');

export async function runPythonVerify() {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(pythonCmd, [PYTHON_SCRIPT], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
  });

  let stdout = '';
  let stderr = '';
  if (child.stdout) {
    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });
  }

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        const output = (stderr || stdout || '').trim();
        const error = new Error(`Script de verificacion termino con codigo ${code}`);
        error.exitCode = code;
        error.output = output;
        reject(error);
      }
    });
    child.on('error', (err) => reject(err));
  });
}
