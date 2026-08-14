import { createSpinner } from 'nanospinner';

import { runCommand } from '../../installation/utils/Runner.js';
import { runInteractiveCommand } from '../shared/InteractiveCommandRunner.js';

const LINUX_PACKAGES = ['mkcert', 'libnss3-tools'];

export class LinuxCertificateToolInstaller {
  constructor({
    boot,
    runner = runCommand,
    interactiveRunner = runInteractiveCommand,
    confirm,
    spinnerFactory = createSpinner
  }) {
    this.boot = boot;
    this.runner = runner;
    this.interactiveRunner = interactiveRunner;
    this.confirm = confirm;
    this.spinnerFactory = spinnerFactory;
  }

  async ensureTool() {
    if (await this._isMkcertAvailable()) return true;
    const accepted = await this.confirm(
      'Local HTTPS requires installing mkcert and libnss3-tools with sudo. Continue?',
      false
    );
    if (!accepted) {
      this.boot.action('Install mkcert and libnss3-tools to enable local HTTPS.');
      return false;
    }
    if (!(await this._isAptAvailable())) {
      this.boot.error('apt-get not found; install mkcert using your distribution\'s package manager.');
      return false;
    }

    this.boot.info('The sudo password will be requested once to install TLS tools.');
    if (!(await this.interactiveRunner('sudo', ['-v']))) return this._reportInstallFailure();

    const spinner = this.spinnerFactory('Updating TLS package index...').start();
    const updated = await this.runner('sudo', ['-n', 'apt-get', 'update', '-qq']);
    if (!updated.success) return this._reportInstallFailure(spinner, updated);

    spinner.update({ text: 'Installing mkcert and Firefox support...' });
    const installed = await this.runner('sudo', [
      '-n', 'env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '-qq', ...LINUX_PACKAGES
    ]);
    if (!installed.success) return this._reportInstallFailure(spinner, installed);

    const available = await this._isMkcertAvailable();
    if (available) spinner.success({ text: 'Ubuntu TLS tools installed.', mark: '  √' });
    else spinner.error({ text: 'mkcert was not available after installation.', mark: '  ×' });
    return available;
  }

  async confirmCertificateAuthority() {
    return this.confirm(
      'mkcert will create and install a local development CA. Do you want to continue?',
      false
    );
  }

  async ensureBrowserTrust() {
    return true;
  }

  async _isMkcertAvailable() {
    return (await this.runner('mkcert', ['--version'])).success;
  }

  async _isAptAvailable() {
    return (await this.runner('apt-get', ['--version'])).success;
  }

  _reportInstallFailure(spinner, result = {}) {
    spinner?.error({ text: 'Could not install TLS tools.', mark: '  ×' });
    this.boot.error('Check the sudo password and APT connection.');
    const detail = String(result.err || result.out || '').trim().split('\n').at(-1);
    if (detail) this.boot.debug(detail);
    return false;
  }
}
