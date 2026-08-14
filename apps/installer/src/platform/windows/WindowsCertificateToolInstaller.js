import { createSpinner } from 'nanospinner';

import { runCommand } from '../../installation/utils/Runner.js';
import { runInteractiveCommand } from '../shared/InteractiveCommandRunner.js';

export class WindowsCertificateToolInstaller {
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
      'Local HTTPS requires installing mkcert via winget. Continue?',
      false
    );
    if (!accepted) {
      this.boot.action('Install mkcert with winget or Chocolatey to enable local HTTPS.');
      return false;
    }
    if (!(await this._isWingetAvailable())) {
      this.boot.error('winget not found. Install mkcert manually or enable App Installer.');
      return false;
    }

    const spinner = this.spinnerFactory('Installing mkcert via winget...').start();
    const installed = await this.runner('winget', [
      'install', '--id', 'FiloSottile.mkcert', '--exact', '--source', 'winget',
      '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'
    ]);
    if (!installed.success) {
      spinner.error({ text: 'Could not install mkcert with winget.', mark: '  ×' });
      const detail = String(installed.err || installed.out || '').trim().split('\n').at(-1);
      if (detail) this.boot.debug(detail);
      return false;
    }
    const available = await this._isMkcertAvailable();
    if (available) spinner.success({ text: 'mkcert installed via winget.', mark: '  √' });
    else spinner.error({ text: 'mkcert was not available after installation.', mark: '  ×' });
    return available;
  }

  async confirmCertificateAuthority() {
    return true;
  }

  async ensureBrowserTrust() {
    return true;
  }

  async _isMkcertAvailable() {
    return (await this.runner('mkcert', ['--version'])).success;
  }

  async _isWingetAvailable() {
    return (await this.runner('winget', ['--version'])).success;
  }
}
