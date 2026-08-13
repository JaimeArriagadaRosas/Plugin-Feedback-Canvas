import { createDockerPolicy } from '../../platform/shared/DockerPolicyFactory.js';
import { DockerRuntimeProbe, DockerRuntimeStatus } from '../../platform/shared/DockerRuntimeProbe.js';
import { PlatformProbe } from '../../platform/shared/PlatformProbe.js';
import { WinDockerInstaller } from '../../platform/windows/WinDockerInstaller.js';
import { MacDockerInstaller } from '../../platform/macos/MacDockerInstaller.js';
import { LinuxDockerInstaller } from '../../platform/linux/LinuxDockerInstaller.js';

export class DockerInstaller {
  constructor(boot, logFile, { platformProbe, probe, strategy } = {}) {
    this.boot = boot;
    this.logFile = logFile;
    this.platformProbe = platformProbe || new PlatformProbe();
    this.host = this.platformProbe.inspect();
    this.platform = this.host.name;
    this.policy = createDockerPolicy(this.host);
    this.probe = probe || new DockerRuntimeProbe({ platformProbe: this.platformProbe });
    this.strategy = strategy || this._createStrategy();
  }

  _createStrategy() {
    if (this.host.isWindows) return new WinDockerInstaller(this.boot, this.logFile);
    if (this.host.isMac) return new MacDockerInstaller(this.boot, this.logFile);
    if (this.host.isLinux) return new LinuxDockerInstaller(this.boot, this.logFile, { host: this.host });
    return null;
  }

  getInstallDetails() {
    return this.policy.install();
  }

  async getRuntimeState() {
    return this.probe.inspect();
  }

  async isDockerInstalled() {
    const state = await this.getRuntimeState();
    if (state.cliAvailable && state.cliOrigin !== 'windows-interop') return true;
    return this.strategy ? this.strategy.isInstalled() : false;
  }

  async isDockerDaemonRunning() {
    const state = await this.getRuntimeState();
    return state.status === DockerRuntimeStatus.ACTIVE;
  }

  async installDocker() {
    if (!this.strategy) {
      this.boot.error(`Sistema operativo no soportado para instalación automática: ${this.platform}`);
      return false;
    }
    return this.strategy.install();
  }

  async waitForDaemon(timeout = this.policy.waitTimeoutSeconds, interval = 5) {
    const { createSpinner } = await import('nanospinner');
    const spinner = createSpinner('Esperando a que el daemon de Docker esté disponible...').start();
    const state = await this.probe.waitUntilActive({
      timeoutSeconds: timeout,
      intervalSeconds: interval,
      onAttempt: ({ attempt, attempts }) => {
        const remaining = Math.max(0, (attempts - attempt) * interval);
        spinner.update({ text: `Esperando el runtime ${this.policy.id} (${remaining}s restantes)...` });
      }
    });
    if (!state) {
      spinner.error({ text: 'Timeout: el daemon de Docker no inició' });
      return false;
    }
    spinner.success({ text: 'Docker daemon disponible', mark: '  √' });
    return true;
  }

  async handleDockerDaemonDown(state = null) {
    const current = state || await this.getRuntimeState();
    const denied = current.status === DockerRuntimeStatus.PERMISSION_DENIED;
    const guidance = denied ? this.policy.permission(current) : this.policy.daemon(current);
    this.boot.warn(guidance.message);
    this.boot.action(guidance.action);
    this.boot.action(guidance.fix);
    if (denied) return false;
    return this.waitForDaemon();
  }
}
