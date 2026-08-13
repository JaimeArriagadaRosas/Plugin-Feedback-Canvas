function rootlessPackagesFor(manager) {
  if (manager === 'apt') return ['uidmap', 'dbus-user-session', 'slirp4netns', 'fuse-overlayfs'];
  if (manager === 'dnf') return ['shadow-utils', 'slirp4netns', 'fuse-overlayfs'];
  if (manager === 'pacman') return ['shadow', 'slirp4netns', 'fuse-overlayfs'];
  return null;
}

export class LinuxRootlessDockerInstaller {
  constructor({ runner, logFile }) {
    this.runner = runner;
    this.logFile = logFile;
  }

  async _runRoot(command, args) {
    return this.runner('sudo', [command, ...args], {
      logFile: this.logFile,
      interactive: true
    });
  }

  async _installPrerequisites(manager) {
    const packages = rootlessPackagesFor(manager);
    if (!packages) return { success: false, err: `Rootless no automatizado para ${manager}.` };
    if (manager === 'apt') return this._runRoot('apt-get', ['install', '-y', ...packages]);
    if (manager === 'dnf') return this._runRoot('dnf', ['install', '-y', ...packages]);
    return this._runRoot('pacman', ['-S', '--needed', '--noconfirm', ...packages]);
  }

  async install(manager, username) {
    const prerequisites = await this._installPrerequisites(manager);
    if (!prerequisites.success) return prerequisites;

    const tool = await this.runner('which', ['dockerd-rootless-setuptool.sh'], { captureAll: true });
    if (!tool.success) {
      return { success: false, err: 'dockerd-rootless-setuptool.sh no está disponible.' };
    }

    const linger = await this._runRoot('loginctl', ['enable-linger', username]);
    if (!linger.success) return linger;
    const setup = await this.runner('dockerd-rootless-setuptool.sh', ['install'], {
      logFile: this.logFile
    });
    if (!setup.success) return setup;
    const service = await this.runner('systemctl', ['--user', 'enable', '--now', 'docker.service'], {
      logFile: this.logFile
    });
    if (!service.success) return service;
    return this.runner('docker', ['info'], { captureAll: true });
  }
}
