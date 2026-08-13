import spawn from 'cross-spawn';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_DOCKER_TIMEOUT_MS = 15 * 60 * 1000;
const CANVAS_RAILS_ENV = { DISABLE_SPRING: '1' };

let _dockerContextCache;

function resolveDockerContext() {
  if (_dockerContextCache !== undefined) return _dockerContextCache;

  const fromEnv = process.env.DOCKER_CONTEXT;
  if (fromEnv && fromEnv.trim().length) {
    _dockerContextCache = fromEnv.trim();
    return _dockerContextCache;
  }

  try {
    const out = execFileSync('docker', ['context', 'show'], { timeout: 5000 }).toString().trim();
    if (out.length) {
      _dockerContextCache = out;
      return _dockerContextCache;
    }
  } catch (_) { /* ignore */ }

  try {
    const configPath = path.join(os.homedir(), '.docker', 'config.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const ctx = cfg && cfg.currentContext;
    if (ctx && ctx.trim().length) {
      _dockerContextCache = ctx.trim();
      return _dockerContextCache;
    }
  } catch (_) { /* ignore */ }

  _dockerContextCache = null;
  return _dockerContextCache;
}

export function buildShellCommand(command, args) {
  return command;
}

export function spawnDocker(args, options = {}) {
  const { cwd, env } = options;
  let finalArgs = args;
  const ctx = resolveDockerContext();
  if (ctx && args.length && args[0] !== 'context') {
    finalArgs = ['--context', ctx, ...args];
  }
  return spawn('docker', finalArgs, {
    cwd,
    env: { ...process.env, ...CANVAS_RAILS_ENV, ...env },
    shell: false
  });
}

export function runDockerCommand(args, options = {}) {
  const { cwd, env, timeoutMs = DEFAULT_DOCKER_TIMEOUT_MS } = options;
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const proc = spawnDocker(args, { cwd, env });
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout tras ${timeoutMs}ms ejecutando: docker ${args.join(' ')}`));
    }, timeoutMs);

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Exit code ${code}. Stderr: ${stderr}\nStdout: ${stdout}`));
    });
  });
}

export function waitForDockerProcess(proc, timeoutMs = DEFAULT_DOCKER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout tras ${timeoutMs}ms esperando proceso Docker`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
