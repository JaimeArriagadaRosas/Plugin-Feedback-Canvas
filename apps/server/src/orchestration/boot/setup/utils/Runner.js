import { execa } from 'execa';
import fs from 'node:fs';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let _dockerContextCache;

/**
 * Número de líneas que el ring buffer retiene en memoria.
 * Las últimas TAIL_LINES líneas de stdout/stderr quedan disponibles
 * en el objeto de retorno; el log completo se escribe a disco si
 * se proporciona `logFile`.
 */
const TAIL_LINES = 50;

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
    // eslint-disable-next-line security/detect-non-literal-fs-filename
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
 * Ring buffer que retiene solo las últimas N líneas, evitando
 * la acumulación ilimitada de strings en memoria.
 */
export class TailBuffer {
  constructor(maxLines = TAIL_LINES) {
    this._lines = [];
    this._maxLines = maxLines;
    this._remainder = '';
  }

  push(chunk) {
    const text = this._remainder + chunk;
    const parts = text.split('\n');
    this._remainder = parts.pop() || '';
    
    if (parts.length > 0) {
      this._lines = this._lines.concat(parts);
      if (this._lines.length > this._maxLines) {
        this._lines = this._lines.slice(-this._maxLines);
      }
    }
  }

  toString() {
    const res = [...this._lines];
    if (this._remainder) res.push(this._remainder);
    return res.slice(-this._maxLines).join('\n');
  }
}

/**
 * Ejecuta un subproceso de forma asíncrona usando execa.
 * Evita el uso de shell: true para prevenir la vulnerabilidad DEP0190.
 *
 * Por defecto, solo retiene las últimas TAIL_LINES líneas de stdout/stderr
 * en memoria (ring buffer) para evitar OOM en procesos con output masivo.
 * El log completo se escribe a disco si se proporciona `logFile`.
 *
 * @param {string} command - Comando a ejecutar.
 * @param {string[]} args - Argumentos del comando.
 * @param {object} options
 * @param {string}   [options.cwd] - Directorio de trabajo.
 * @param {number}   [options.timeout] - Timeout en ms.
 * @param {string}   [options.logFile] - Ruta al archivo de log en disco.
 * @param {Function} [options.onData] - Callback invocado con cada chunk (str, isStderr).
 * @param {object}   [options.env] - Variables de entorno adicionales.
 * @param {string}   [options.input] - Datos a enviar a stdin.
 * @param {boolean}  [options.captureAll=false] - Si es true, acumula TODO el output
 *                   en memoria (útil para comandos cortos como `docker --version`).
 *                   ⚠️  No usar con procesos que generan output masivo.
 * @returns {Promise<{ success: boolean, out: string, err: string, code: number }>}
 */
export async function runCommand(command, args = [], options = {}) {
  const { cwd, timeout, logFile, onData, env, input, captureAll = false } = options;

  // Acumuladores: ring buffer por defecto, string completo si captureAll
  let outAccum = captureAll ? '' : new TailBuffer();
  let errAccum = captureAll ? '' : new TailBuffer();

  let finalCommand = command;
  let finalArgs = args;

  if (command === 'docker' && args.length && args[0] !== 'context') {
    const ctx = await resolveDockerContext();
    if (ctx) finalArgs = ['--context', ctx, ...args];
  }

  let logStream = null;

  try {
    if (logFile) {
      // Encabezado síncrono (una sola línea, inocuo)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(logFile, `\n--- Ejecutando: ${finalCommand} ${finalArgs.join(' ')} ---\n`);
      // Stream asíncrono para el output del proceso
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      logStream = createWriteStream(logFile, { flags: 'a' });
    }

    const child = execa(finalCommand, finalArgs, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      input,
      buffer: captureAll
    });

    const handleData = (data, isStderr) => {
      const str = data.toString();
      
      if (isStderr) {
        if (captureAll) { errAccum += str; } else { errAccum.push(str); }
      } else {
        if (captureAll) { outAccum += str; } else { outAccum.push(str); }
      }
      
      if (onData) onData(str, isStderr);

      if (logStream) {
        const canWrite = logStream.write(str);
        if (!canWrite) {
          const streamToPause = isStderr ? child.stderr : child.stdout;
          if (streamToPause) streamToPause.pause();
          logStream.once('drain', () => {
            if (streamToPause) streamToPause.resume();
          });
        }
      }
    };

    if (child.stdout) {
      child.stdout.on('data', (data) => handleData(data, false));
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => handleData(data, true));
    }

    const result = await child;
    return {
      success: result.exitCode === 0,
      out: captureAll ? (result.stdout || outAccum) : outAccum.toString(),
      err: captureAll ? (result.stderr || errAccum) : errAccum.toString(),
      code: result.exitCode
    };
  } catch (error) {
    // En modo captureAll, incorporar output residual del error de execa
    if (captureAll) {
      if (error.stdout) outAccum += error.stdout;
      if (error.stderr) errAccum += error.stderr;
    } else {
      if (error.stdout) outAccum.push(error.stdout);
      if (error.stderr) errAccum.push(error.stderr);
    }

    const outStr = captureAll ? outAccum : outAccum.toString();
    let errStr = captureAll ? errAccum : errAccum.toString();
    if (!outStr && !errStr) errStr = `[EXECA ERROR] ${error?.message || String(error)} \n ${error?.stack || ''}`;
    return { success: false, out: outStr, err: errStr, code: error?.exitCode || -1 };
  } finally {
    if (logStream) {
      await new Promise((resolve) => logStream.end(resolve));
      logStream.destroy();
    }
  }
}
