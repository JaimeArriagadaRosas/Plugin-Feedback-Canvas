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

export function classifyDockerCliOrigin({ host, cliPath, clientPlatform, dockerHost, contextEndpoint }) {
  if (dockerHost && !dockerHost.startsWith('unix://')) return 'remote';
  if (contextEndpoint && (contextEndpoint.startsWith('ssh://') || contextEndpoint.startsWith('tcp://'))) return 'remote';
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
      this.runner('docker', ['context', 'inspect'], { captureAll: true, timeout: 5000 }),
      this.runner('docker', ['version', '--format', '{{.Client.Os}}/{{.Client.Arch}}'], { captureAll: true, timeout: 8000 }),
      this.runner('docker', ['info', '--format', '{{json .}}'], { captureAll: true, timeout: 10000 }),
      this.runner('docker', ['compose', 'version'], { captureAll: true, timeout: 8000 })
    ]);

    let contextEndpoint = '';
    let contextName = '';
    if (contextResult.success) {
      try {
        const contexts = JSON.parse(contextResult.out);
        if (contexts && contexts.length > 0) {
          contextName = contexts[0].Name || '';
          contextEndpoint = contexts[0].Endpoints?.docker?.Host || '';
        }
      } catch (e) {}
    }

    const clientPlatform = firstLine(clientResult.out);
    const cliOrigin = classifyDockerCliOrigin({
      host,
      cliPath,
      clientPlatform,
      dockerHost: this.env.DOCKER_HOST,
      contextEndpoint
    });

    let daemonError = '';
    let infoData = null;
    let securityOptions = [];
    let memoryBytes = null;
    let daemonAvailable = infoResult.success;

    if (infoResult.success) {
      try {
        infoData = JSON.parse(infoResult.out);
        securityOptions = infoData.SecurityOptions || [];
        memoryBytes = infoData.MemTotal || null;
      } catch (e) {
        daemonError = 'Invalid JSON output from docker info';
        daemonAvailable = false;
      }
    } else {
      daemonError = `${infoResult.err || ''}\n${infoResult.out || ''}`.trim();
    }

    const isRootless = securityOptions.includes('name=rootless') || contextName === 'rootless';
    const isUsernsRemap = securityOptions.includes('name=userns');

    // Determinamos si el instalador se ejecuta con privilegios elevados (sudo)
    const isRootUser = process.getuid ? process.getuid() === 0 : false;
    let hostUid = null;
    if (isRootUser && this.env.SUDO_UID) {
      hostUid = Number.parseInt(this.env.SUDO_UID, 10);
    } else if (process.getuid) {
      hostUid = process.getuid();
    }

    const permissionDenied = /permission denied|access denied|eacces/i.test(daemonError);
    const status = daemonAvailable
      ? DockerRuntimeStatus.ACTIVE
      : permissionDenied
        ? DockerRuntimeStatus.PERMISSION_DENIED
        : DockerRuntimeStatus.DAEMON_DOWN;

    return {
      status,
      host,
      backend: classifyBackend(host, cliOrigin),
      cliAvailable: true,
      cliOrigin,
      cliPath,
      cliVersion: firstLine(cli.out),
      clientPlatform,
      context: contextName,
      contextEndpoint,
      composeAvailable: composeResult.success,
      daemonAvailable,
      permissionDenied,
      memoryBytes,
      memoryGb: memoryBytes === null ? null : memoryBytes / 1024 ** 3,
      error: daemonAvailable ? '' : daemonError,
      capabilities: {
        rootless: isRootless,
        usernsRemap: isUsernsRemap,
        installerIsRoot: isRootUser,
        hostUid,
        dockerHostVar: this.env.DOCKER_HOST || null,
        dockerContextVar: this.env.DOCKER_CONTEXT || null
      }
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
