import { runCommand } from '../../installation/utils/Runner.js';
import { PlatformProbe } from './PlatformProbe.js';

export const DockerRuntimeStatus = Object.freeze({
  ACTIVE: 'active',
  MISSING: 'missing',
  DAEMON_DOWN: 'daemon-down',
  PERMISSION_DENIED: 'permission-denied'
});

function firstLine(value = '') {
  return value.split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
}

function parseMemoryBytes(value = '') {
  const normalized = value.trim();
  return /^\d+$/.test(normalized) ? Number.parseInt(normalized, 10) : null;
}

export function classifyDockerCliOrigin({ host, cliPath, clientPlatform, dockerHost }) {
  if (dockerHost) return 'remote';
  const mountedWindowsPath = /^\/mnt\/[a-z]\//i.test(cliPath || '');
  const windowsClient = /^windows(?:\/|$)/i.test(clientPlatform || '');
  if (host.isWsl && (mountedWindowsPath || windowsClient)) return 'windows-interop';
  return 'native';
}

function classifyBackend(host, cliOrigin) {
  if (cliOrigin === 'remote') return 'remote';
  if (cliOrigin === 'windows-interop') return 'docker-desktop-wsl';
  if (host.isWindows) return 'docker-desktop-windows';
  if (host.isMac) return 'docker-desktop-mac';
  return 'docker-engine-linux';
}

export class DockerRuntimeProbe {
  constructor({
    runner = runCommand,
    platformProbe = new PlatformProbe(),
    env = process.env,
    delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  } = {}) {
    this.runner = runner;
    this.platformProbe = platformProbe;
    this.env = env;
    this.delay = delay;
  }

  async _findCliPath(host) {
    const command = host.isWindows ? 'where.exe' : 'which';
    const result = await this.runner(command, ['docker'], { captureAll: true, timeout: 5000 });
    return result.success ? firstLine(result.out) : '';
  }

  async inspect() {
    const host = this.platformProbe.inspect();
    const cli = await this.runner('docker', ['--version'], { captureAll: true, timeout: 8000 });
    if (!cli.success) {
      return {
        status: DockerRuntimeStatus.MISSING,
        host,
        cliAvailable: false,
        cliOrigin: 'none',
        composeAvailable: false,
        daemonAvailable: false,
        error: cli.err || cli.out
      };
    }

    const [cliPath, contextResult, clientResult, infoResult, composeResult] = await Promise.all([
      this._findCliPath(host),
      this.runner('docker', ['context', 'show'], { captureAll: true, timeout: 5000 }),
      this.runner('docker', ['version', '--format', '{{.Client.Os}}/{{.Client.Arch}}'], { captureAll: true, timeout: 8000 }),
      this.runner('docker', ['info', '--format', '{{.MemTotal}}'], { captureAll: true, timeout: 10000 }),
      this.runner('docker', ['compose', 'version'], { captureAll: true, timeout: 8000 })
    ]);
    const clientPlatform = firstLine(clientResult.out);
    const cliOrigin = classifyDockerCliOrigin({
      host,
      cliPath,
      clientPlatform,
      dockerHost: this.env.DOCKER_HOST
    });
    const daemonError = `${infoResult.err || ''}\n${infoResult.out || ''}`.trim();
    const permissionDenied = /permission denied|access denied|eacces/i.test(daemonError);
    const status = infoResult.success
      ? DockerRuntimeStatus.ACTIVE
      : permissionDenied
        ? DockerRuntimeStatus.PERMISSION_DENIED
        : DockerRuntimeStatus.DAEMON_DOWN;
    const memoryBytes = infoResult.success ? parseMemoryBytes(infoResult.out) : null;

    return {
      status,
      host,
      backend: classifyBackend(host, cliOrigin),
      cliAvailable: true,
      cliOrigin,
      cliPath,
      cliVersion: firstLine(cli.out),
      clientPlatform,
      context: contextResult.success ? firstLine(contextResult.out) : '',
      composeAvailable: composeResult.success,
      daemonAvailable: infoResult.success,
      permissionDenied,
      memoryBytes,
      memoryGb: memoryBytes === null ? null : memoryBytes / 1024 ** 3,
      error: infoResult.success ? '' : daemonError
    };
  }

  async waitUntilActive({ timeoutSeconds = 90, intervalSeconds = 5, onAttempt } = {}) {
    const attempts = Math.max(1, Math.ceil(timeoutSeconds / intervalSeconds));
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const state = await this.inspect();
      if (state.status === DockerRuntimeStatus.ACTIVE) return state;
      if (onAttempt) onAttempt({ attempt, attempts, state });
      if (attempt < attempts) await this.delay(intervalSeconds * 1000);
    }
    return null;
  }
}
