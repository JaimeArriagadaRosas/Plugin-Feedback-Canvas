import os from 'node:os';
import { runCommand } from '../../installation/utils/Runner.js';
import { askConfirm } from '../../orchestration/cli.js';
import { LinuxAptDockerInstaller } from './LinuxAptDockerInstaller.js';
import { LinuxRootlessDockerInstaller } from './LinuxRootlessDockerInstaller.js';

export class LinuxDockerInstaller {
  constructor(boot, logFile, {
    host = {},
    runner = runCommand,
    username = () => os.userInfo().username,
    confirmGroup = askConfirm,
    confirmRootless = askConfirm,
    aptInstaller,
    rootlessInstaller
  } = {}) {
    this.boot = boot;
    this.logFile = logFile;
    this.host = host;
    this.runner = runner;
    this.username = username;
    this.confirmGroup = confirmGroup;
    this.confirmRootless = confirmRootless;
    this.aptInstaller = aptInstaller || new LinuxAptDockerInstaller({ runner, logFile });
    this.rootlessInstaller = rootlessInstaller || new LinuxRootlessDockerInstaller({ runner, logFile });
  }

  async _has(command) {
    return (await this.runner('which', [command], { captureAll: true })).success;
  }

  async isInstalled() {
    const result = await this.runner('which', ['docker'], { captureAll: true });
    if (!result.success) return false;
    const cliPath = result.out.trim().replaceAll('\\', '/');
    return !(this.host.isWsl && /^\/mnt\/[a-z]\//i.test(cliPath));
  }

  async _detectPackageManager() {
    if (await this._has('apt-get')) return 'apt';
    if (await this._has('dnf')) return 'dnf';
    if (await this._has('pacman')) return 'pacman';
    return null;
  }

  async _runPrivileged(command, args) {
    return this.runner('sudo', [command, ...args], {
      logFile: this.logFile,
      interactive: true
    });
  }

  async _installPackages(manager) {
    if (manager === 'apt') return this.aptInstaller.install();
    if (manager === 'dnf') {
      return this._runPrivileged('dnf', ['install', '-y', 'docker', 'docker-compose-plugin']);
    }
    return this._runPrivileged('pacman', ['-S', '--needed', '--noconfirm', 'docker', 'docker-compose', 'docker-buildx']);
  }

  async _enableService() {
    if (!(await this._has('systemctl'))) {
      return { success: false, err: 'systemctl is not available on this distribution.' };
    }
    return this._runPrivileged('systemctl', ['enable', '--now', 'docker']);
  }

  async _grantCurrentUserAccess() {
    return this._runPrivileged('usermod', ['-aG', 'docker', this.username()]);
  }

  async install() {
    this.boot.info(`Preparing native Docker Engine on ${this.host.isWsl ? 'WSL/Linux' : 'Linux'}...`);
    const manager = await this._detectPackageManager();
    if (!manager) {
      this.boot.error('Could not find a compatible package manager (apt-get, dnf, or pacman).');
      this.boot.action('Install Docker Engine manually from https://docs.docker.com/engine/install/.');
      return false;
    }

    this.boot.warn(`Sudo privileges will be requested to install packages via ${manager}.`);
    const installed = await this._installPackages(manager);
    if (!installed.success) {
      this.boot.error(`Could not install Docker Engine: ${installed.err}`);
      return false;
    }

    this.boot.info('Recommended mode: Rootless Docker avoids granting root-equivalent access through the docker group.');
    const useRootless = await this.confirmRootless('Configure rootless Docker for the current user?', true);
    if (useRootless) {
      const rootless = await this.rootlessInstaller.install(manager, this.username());
      if (rootless.success) {
        this.boot.success('Rootless Docker is now active for the current user.');
        return true;
      }
      this.boot.warn(`Could not configure rootless Docker: ${rootless.err}`);
      this.boot.action('You can continue with the system daemon if you explicitly authorize the docker group.');
    }

    const service = await this._enableService();
    if (!service.success) {
      this.boot.error(`Docker was installed, but the service could not be started: ${service.err}`);
      return false;
    }

    this.boot.warn('SECURITY: belonging to the docker group allows controlling containers with root-equivalent privileges.');
    const grantAccess = await this.confirmGroup('Do you authorize adding the current user to the docker group with that privilege level?');
    if (grantAccess) {
      const group = await this._grantCurrentUserAccess();
      if (!group.success) {
        this.boot.warn(`Docker is active, but the user group could not be updated: ${group.err}`);
        return false;
      }
    } else {
      this.boot.action('The docker group was not modified. Configure rootless Docker or use sudo explicitly to manage it.');
      return true;
    }

    this.boot.success('Docker Engine and Compose V2 are now installed via the configured Linux provider.');
    this.boot.warn('You must start a new session for the docker group to apply to the current process.');
    this.boot.action(this.host.isWsl
      ? 'From Windows, run `wsl --shutdown`, open Ubuntu again, and resume `npm start`.'
      : 'Log out, log back in, and resume `npm start`.');
    return true;
  }

  async isUpdating() {
    return false;
  }
}
