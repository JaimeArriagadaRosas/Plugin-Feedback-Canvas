import { runCommand } from '../../installation/utils/Runner.js';
import { runInteractiveCommand } from '../shared/InteractiveCommandRunner.js';

export class WindowsCertificateToolInstaller {
  constructor({ boot, runner = runCommand, interactiveRunner = runInteractiveCommand, confirm }) {
    this.boot = boot;
    this.runner = runner;
    this.interactiveRunner = interactiveRunner;
    this.confirm = confirm;
  }

  async ensureTool() {
    if (await this._isMkcertAvailable()) return true;
    const accepted = await this.confirm(
      'HTTPS local requiere instalar mkcert mediante winget. ¿Continuar?',
      false
    );
    if (!accepted) {
      this.boot.action('Instale mkcert con winget o Chocolatey para habilitar HTTPS local.');
      return false;
    }
    if (!(await this._isWingetAvailable())) {
      this.boot.error('No se encontró winget. Instale mkcert manualmente o habilite App Installer.');
      return false;
    }

    this.boot.info('Instalando mkcert mediante winget...');
    const installed = await this.interactiveRunner('winget', [
      'install', '--id', 'FiloSottile.mkcert', '--exact', '--source', 'winget',
      '--accept-package-agreements', '--accept-source-agreements'
    ]);
    if (!installed) {
      this.boot.error('No se pudo instalar mkcert con winget.');
      return false;
    }
    return this._isMkcertAvailable();
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
