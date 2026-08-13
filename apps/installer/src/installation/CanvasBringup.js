import { createContainerWorkspacePermissions } from '../platform/shared/ContainerWorkspacePermissionsFactory.js';
import { runCommand } from './utils/Runner.js';

const DEFAULT_HEALTH_URL = 'http://localhost:8080';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createDefaultHealthCheck() {
  return async (url) => {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000)
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  };
}

export class CanvasBringup {
  constructor(boot, canvasDir, {
    runner = runCommand,
    platform = process.platform,
    containerWorkspacePermissions,
    healthCheck = createDefaultHealthCheck(),
    healthUrl = process.env.CANVAS_HEALTH_URL || DEFAULT_HEALTH_URL,
    sleep = wait
  } = {}) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.healthCheck = healthCheck;
    this.healthUrl = healthUrl;
    this.sleep = sleep;
    this.containerWorkspacePermissions = containerWorkspacePermissions ||
      createContainerWorkspacePermissions(platform, { runner });
    this.containerExecArgs = [];
  }

  async bringup() {
    this.boot.info('Iniciando stack de Canvas LMS...');
    if (!(await this.startStack())) return false;
    if (!(await this._prepareContainerWorkspace())) return false;
    if (!(await this.ensureRubyDependencies())) return false;
    return this.waitForReady();
  }

  async startStack() {
    this.boot.info('Iniciando contenedores de Canvas LMS...');
    const result = await this.runner('docker', ['compose', 'up', '-d'], { cwd: this.canvasDir });
    if (!result.success) {
      this.boot.error(`Error al iniciar Docker Compose: ${result.err}`);
      return false;
    }
    this.boot.success('Contenedores de Canvas LMS iniciados');
    return true;
  }

  async ensureRubyDependencies() {
    this.boot.info('Verificando dependencias Ruby de Canvas...');
    const check = await this._runWebCommand(['bundle', 'check']);
    if (check.success) {
      this.boot.success('Dependencias Ruby listas');
      return true;
    }

    this.boot.info('Dependencias Ruby incompletas. Instalando gems...');
    if (!(await this._installBundlerPlugin())) return false;

    const install = await this._runWebCommand(['bundle', 'install', '--jobs=2'], {
      extraExecArgs: ['-e', 'BUNDLE_FROZEN=false']
    });
    if (!install.success) {
      this.boot.error('Error instalando dependencias Ruby (bundle install)');
      this.boot.error(`bundle install falló: ${install.out} ${install.err}`);
      return false;
    }

    const restarted = await this.runner('docker', ['compose', 'restart', 'web', 'jobs'], {
      cwd: this.canvasDir
    });
    if (!restarted.success) {
      this.boot.error(`No se pudieron reiniciar los servicios de Canvas: ${restarted.err}`);
      return false;
    }

    this.boot.success('Dependencias Ruby instaladas y servicios reiniciados');
    return true;
  }

  async waitForReady(timeout = 180, interval = 5) {
    this.boot.info('Esperando a que Canvas LMS responda...');
    for (let elapsed = 0; elapsed <= timeout; elapsed += interval) {
      const web = await this.runner('docker', ['compose', 'ps', '-q', 'web'], {
        cwd: this.canvasDir,
        captureAll: true
      });
      if (web.success && web.out.trim() && await this.healthCheck(this.healthUrl)) {
        this.boot.success('Canvas LMS está listo para recibir solicitudes');
        return true;
      }
      if (elapsed < timeout) await this.sleep(interval * 1000);
    }

    this.boot.error(`Timeout: Canvas LMS no respondió por HTTP en ${timeout}s`);
    return false;
  }

  async _prepareContainerWorkspace() {
    const args = await this.containerWorkspacePermissions.prepare({
      canvasDir: this.canvasDir,
      logFile: null,
      boot: this.boot
    });
    if (args === null) return false;
    this.containerExecArgs = args;
    return true;
  }

  async _installBundlerPlugin() {
    const plugin = await this._runWebCommand(
      ['bundle', 'plugin', 'install', 'bundler-multilock'],
      { useWorkspacePermissions: false }
    );
    if (plugin.success) return true;
    this.boot.error(`No se pudo instalar bundler-multilock: ${plugin.err}`);
    return false;
  }

  _runWebCommand(commandArgs, {
    useWorkspacePermissions = true,
    extraExecArgs = []
  } = {}) {
    const workspaceArgs = useWorkspacePermissions ? this.containerExecArgs : [];
    return this.runner('docker', [
      'compose', 'exec', '-T', ...workspaceArgs, ...extraExecArgs, 'web', ...commandArgs
    ], { cwd: this.canvasDir });
  }
}
