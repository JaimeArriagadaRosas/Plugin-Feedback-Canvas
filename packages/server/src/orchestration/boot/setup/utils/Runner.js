import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Ejecuta un subproceso de forma asíncrona usando execa.
 * Evita el uso de shell: true para prevenir la vulnerabilidad DEP0190.
 */
export async function runCommand(command, args = [], options = {}) {
  const { cwd, timeout, logFile, onData, env } = options;
  let out = '';
  let err = '';

  try {
    if (logFile) {
      fs.appendFileSync(logFile, `\n--- Ejecutando: ${command} ${args.join(' ')} ---\n`);
    }

    const child = execa(command, args, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const str = data.toString();
        out += str;
        if (logFile) fs.appendFileSync(logFile, str);
        if (onData) onData(str, false);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const str = data.toString();
        err += str;
        if (logFile) fs.appendFileSync(logFile, str);
        if (onData) onData(str, true);
      });
    }

    const result = await child;
    return { success: result.exitCode === 0, out, err, code: result.exitCode };
  } catch (error) {
    if (error.stdout) out += error.stdout;
    if (error.stderr) err += error.stderr;
    return { success: false, out, err, code: error.exitCode || -1 };
  }
}
