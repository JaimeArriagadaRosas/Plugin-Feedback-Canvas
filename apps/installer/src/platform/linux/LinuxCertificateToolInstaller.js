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
      'HTTPS local requiere instalar mkcert y libnss3-tools con sudo. ¿Continuar?',
      false
    );
    if (!accepted) {
      this.boot.action('Instale mkcert y libnss3-tools para habilitar HTTPS local.');
      return false;
    }
    if (!(await this._isAptAvailable())) {
      this.boot.error('No se encontró apt-get; instale mkcert según el gestor de paquetes de su distribución.');
      return false;
    }

    this.boot.info('Se solicitará la contraseña sudo una sola vez para instalar las herramientas TLS.');
    if (!(await this.interactiveRunner('sudo', ['-v']))) return this._reportInstallFailure();

    const spinner = this.spinnerFactory('Actualizando índice de paquetes TLS...').start();
    const updated = await this.runner('sudo', ['-n', 'apt-get', 'update', '-qq']);
    if (!updated.success) return this._reportInstallFailure(spinner, updated);

    spinner.update({ text: 'Instalando mkcert y soporte para Firefox...' });
    const installed = await this.runner('sudo', [
      '-n', 'env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '-qq', ...LINUX_PACKAGES
    ]);
    if (!installed.success) return this._reportInstallFailure(spinner, installed);

    const available = await this._isMkcertAvailable();
    if (available) spinner.success({ text: 'Herramientas TLS de Ubuntu instaladas.', mark: '  √' });
    else spinner.error({ text: 'mkcert no quedó disponible tras la instalación.', mark: '  ×' });
    return available;
  }

  async confirmCertificateAuthority() {
    return this.confirm(
      'mkcert creará e instalará una CA local de desarrollo. ¿Desea continuar?',
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
    spinner?.error({ text: 'No se pudieron instalar las herramientas TLS.', mark: '  ×' });
    this.boot.error('Revise la contraseña sudo y la conexión de APT.');
    const detail = String(result.err || result.out || '').trim().split('\n').at(-1);
    if (detail) this.boot.debug(detail);
    return false;
  }
}
