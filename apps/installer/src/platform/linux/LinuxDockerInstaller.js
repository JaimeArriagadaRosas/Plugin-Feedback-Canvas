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
      return { success: false, err: 'systemctl no está disponible en esta distribución.' };
    }
    return this._runPrivileged('systemctl', ['enable', '--now', 'docker']);
  }

  async _grantCurrentUserAccess() {
    return this._runPrivileged('usermod', ['-aG', 'docker', this.username()]);
  }

  async install() {
    this.boot.info(`Preparando Docker Engine nativo en ${this.host.isWsl ? 'WSL/Linux' : 'Linux'}...`);
    const manager = await this._detectPackageManager();
    if (!manager) {
      this.boot.error('No se encontró un gestor compatible (apt-get, dnf o pacman).');
      this.boot.action('Instale Docker Engine manualmente desde https://docs.docker.com/engine/install/.');
      return false;
    }

    this.boot.warn(`Se solicitarán privilegios sudo para instalar paquetes mediante ${manager}.`);
    const installed = await this._installPackages(manager);
    if (!installed.success) {
      this.boot.error(`No se pudo instalar Docker Engine: ${installed.err}`);
      return false;
    }

    this.boot.info('Modo recomendado: Docker rootless evita conceder acceso equivalente a root mediante el grupo docker.');
    const useRootless = await this.confirmRootless('¿Configurar Docker rootless para el usuario actual?', true);
    if (useRootless) {
      const rootless = await this.rootlessInstaller.install(manager, this.username());
      if (rootless.success) {
        this.boot.success('Docker rootless quedó activo para el usuario actual.');
        return true;
      }
      this.boot.warn(`No se pudo configurar Docker rootless: ${rootless.err}`);
      this.boot.action('Puede continuar con el daemon del sistema si autoriza explícitamente el grupo docker.');
    }

    const service = await this._enableService();
    if (!service.success) {
      this.boot.error(`Docker se instaló, pero no se pudo iniciar el servicio: ${service.err}`);
      return false;
    }

    this.boot.warn('SEGURIDAD: pertenecer al grupo docker permite controlar contenedores con privilegios equivalentes a root.');
    const grantAccess = await this.confirmGroup('¿Autoriza agregar el usuario actual al grupo docker con ese nivel de privilegio?');
    if (grantAccess) {
      const group = await this._grantCurrentUserAccess();
      if (!group.success) {
        this.boot.warn(`Docker está activo, pero no se pudo actualizar el grupo del usuario: ${group.err}`);
        return false;
      }
    } else {
      this.boot.action('No se modificó el grupo docker. Configure Docker rootless o use sudo explícitamente para administrarlo.');
      return true;
    }

    this.boot.success('Docker Engine y Compose V2 quedaron instalados mediante el proveedor Linux configurado.');
    this.boot.warn('Debe abrir una sesión nueva para que el grupo docker se aplique al proceso actual.');
    this.boot.action(this.host.isWsl
      ? 'Desde Windows ejecute `wsl --shutdown`, vuelva a abrir Ubuntu y reanude `npm start`.'
      : 'Cierre sesión, vuelva a entrar y reanude `npm start`.');
    return true;
  }

  async isUpdating() {
    return false;
  }
}
