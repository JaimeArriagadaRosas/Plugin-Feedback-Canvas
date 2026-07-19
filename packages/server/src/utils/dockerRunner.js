import spawn from 'cross-spawn';

const DEFAULT_DOCKER_TIMEOUT_MS = 15 * 60 * 1000;
const CANVAS_RAILS_ENV = { DISABLE_SPRING: '1' };

export function buildShellCommand(command, args) {
  return command;
}

export function spawnDocker(args, options = {}) {
  const { cwd, env } = options;
  return spawn('docker', args, {
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
