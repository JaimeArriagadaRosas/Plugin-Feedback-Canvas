import os from 'node:os';
import { runCommand } from '../utils/Runner.js';
import { WinDockerInstaller } from './strategies/WinDockerInstaller.js';
import { MacDockerInstaller } from './strategies/MacDockerInstaller.js';
import { LinuxDockerInstaller } from './strategies/LinuxDockerInstaller.js';

export class DockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
    this.platform = os.platform(); // 'win32', 'darwin', 'linux'
    
    // Inicializar la estrategia adecuada
    if (this.platform === 'win32') {
      this.strategy = new WinDockerInstaller(boot, logFile);
    } else if (this.platform === 'darwin') {
      this.strategy = new MacDockerInstaller(boot, logFile);
    } else if (this.platform === 'linux') {
      this.strategy = new LinuxDockerInstaller(boot, logFile);
    } else {
      this.strategy = null;
    }
  }

  async isDockerInstalled() {
    if (!this.strategy) return false;
    return this.strategy.isInstalled();
  }

  async isDockerDaemonRunning() {
    const { success } = await runCommand('docker', ['info']);
    return success;
  }

  async installDocker() {
    if (!this.strategy) {
      this.boot.error(`Sistema operativo no soportado para instalación automática: ${this.platform}`);
      return false;
    }
    return this.strategy.install();
  }

  async waitForDaemon(timeout = 600, interval = 5) {
    let elapsed = 0;
    const spinner = (await import('nanospinner')).createSpinner('Esperando a que el daemon de Docker esté disponible...').start();
    
    while (elapsed < timeout) {
      if (await this.isDockerDaemonRunning()) {
        spinner.success({ text: `Docker daemon disponible (tras ${elapsed}s)`, mark: '  √' });
        return true;
      }

      let isUpdating = false;
      if (this.strategy && typeof this.strategy.isUpdating === 'function') {
        isUpdating = await this.strategy.isUpdating();
      }

      await new Promise(r => setTimeout(r, interval * 1000));
      elapsed += interval;
      
      if (isUpdating) {
        spinner.update({ text: `Docker Desktop se está instalando o actualizando. Esperando adaptativamente (restan ${Math.floor((timeout - elapsed) / 60)} min)...` });
      } else if (elapsed === 30) {
        spinner.update({ text: `El daemon de Docker tarda más de 30s en iniciar. Sigo esperando...` });
      }
    }
    spinner.error({ text: 'Timeout: el daemon de Docker no inició' });
    return false;
  }

  async handleDockerDaemonDown() {
    this.boot.warn('La aplicación de Docker Desktop (Daemon) está cerrada o no tiene los permisos suficientes.');
    this.boot.action('👉 Por favor, abre tu aplicación de Docker Desktop manualmente para continuar, o acepta el aviso del sistema operativo si aparece.');
    return this.waitForDaemon(600, 5);
  }
}

