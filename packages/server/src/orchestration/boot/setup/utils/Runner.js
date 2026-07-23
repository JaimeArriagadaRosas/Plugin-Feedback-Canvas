import { execa } from 'execa';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let _dockerContextCache;

async function resolveDockerContext() {
  if (_dockerContextCache !== undefined) return _dockerContextCache;

  const fromEnv = process.env.DOCKER_CONTEXT;
  if (fromEnv && fromEnv.trim().length) {
    _dockerContextCache = fromEnv.trim();
    return _dockerContextCache;
  }

  try {
    const { stdout } = await execa('docker', ['context', 'show'], { timeout: 5000 });
    const ctx = (stdout || '').trim();
    if (ctx.length) {
      _dockerContextCache = ctx;
      return _dockerContextCache;
    }
  } catch (_) { /* ignore */ }

  try {
    const configPath = path.join(os.homedir(), '.docker', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = JSON.parse(raw);
    const ctx = cfg && cfg.currentContext;
    if (ctx && ctx.trim().length) {
      _dockerContextCache = ctx.trim();
      return _dockerContextCache;
    }
  } catch (_) { /* ignore */ }

  _dockerContextCache = null;
  return _dockerContextCache;
}

/**
 * Ejecuta un subproceso de forma asíncrona usando execa.
 * Evita el uso de shell: true para prevenir la vulnerabilidad DEP0190.
 */
export async function runCommand(command, args = [], options = {}) {
  const { cwd, timeout, logFile, onData, env, input } = options;
  let out = '';
  let err = '';

  let finalCommand = command;
  let finalArgs = args;

  if (command === 'docker' && args.length && args[0] !== 'context') {
    const ctx = await resolveDockerContext();
    if (ctx) finalArgs = ['--context', ctx, ...args];
  }

  try {
    if (logFile) {
      fs.appendFileSync(logFile, `\n--- Ejecutando: ${finalCommand} ${finalArgs.join(' ')} ---\n`);
    }

    const child = execa(finalCommand, finalArgs, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      input,
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
    if (!out && !err) err = `[EXECA ERROR] ${error.message} \n ${error.stack || ''}`;
    return { success: false, out, err, code: error.exitCode || -1 };
  }
}
