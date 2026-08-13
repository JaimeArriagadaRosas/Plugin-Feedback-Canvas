import { runCommand } from '../../installation/utils/Runner.js';
import { runInteractiveCommand } from '../shared/InteractiveCommandRunner.js';

const LINUX_PACKAGES = ['mkcert', 'libnss3-tools'];

export class LinuxCertificateToolInstaller {
  constructor({ boot, runner = runCommand, interactiveRunner = runInteractiveCommand, confirm }) {
    this.boot = boot;
    this.runner = runner;
    this.interactiveRunner = interactiveRunner;
    this.confirm = confirm;
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

    this.boot.info('Instalando dependencias TLS de Ubuntu; se solicitará su contraseña sudo si corresponde.');
    if (!(await this.interactiveRunner('sudo', ['apt-get', 'update']))) return this._reportInstallFailure();
    if (!(await this.interactiveRunner('sudo', ['apt-get', 'install', '-y', ...LINUX_PACKAGES]))) {
      return this._reportInstallFailure();
    }
    return this._isMkcertAvailable();
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

  _reportInstallFailure() {
    this.boot.error('No se pudo instalar mkcert. Revise la contraseña sudo y la conexión de APT.');
    return false;
  }
}
