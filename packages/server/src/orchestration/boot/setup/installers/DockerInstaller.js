import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from '../utils/Runner.js';

export class DockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
    this.platform = os.platform(); // 'win32', 'darwin', 'linux'
  }

  async isDockerInstalled() {
    const { success } = await runCommand('docker', ['--version']);
    return success;
  }

  async isDockerDaemonRunning() {
    const { success } = await runCommand('docker', ['info']);
    return success;
  }

  async installDocker() {
    if (this.platform === 'win32') {
      return this._installWindows();
    } else if (this.platform === 'darwin') {
      return this._installMac();
    } else if (this.platform === 'linux') {
      return this._installLinux();
    }
    this.boot.error(`Sistema operativo no soportado para instalación automática: ${this.platform}`);
    return false;
  }

  async _installWindows() {
    this.boot.info('Descargando Docker Desktop Installer...');
    const url = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';
    const dest = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'DockerDesktopInstaller.exe');
    
    // Simplificación de descarga para Node
    const { success, err } = await runCommand('powershell', [
      '-Command',
      `Invoke-WebRequest -Uri "${url}" -OutFile "${dest}"`
    ], { logFile: this.logFile });

    if (!success) {
      this.boot.error(`No se pudo descargar Docker Desktop: ${err}`);
      return false;
    }

    this.boot.info('Ejecutando instalador de Docker Desktop... Por favor siga las instrucciones.');
    // start-process no bloquea
    runCommand('powershell', ['-Command', `Start-Process -FilePath "${dest}"`]);
    
    this.boot.warn('IMPORTANTE: Debe reiniciar su equipo después de que Docker termine de instalarse.');
    return true;
  }

  async _installMac() {
    this.boot.info('Descargando Docker Desktop para macOS...');
    const url = 'https://desktop.docker.com/mac/main/amd64/Docker.dmg';
    const dest = path.join(os.tmpdir(), 'Docker.dmg');
    
    const { success, err } = await runCommand('curl', ['-L', '-o', dest, url], { logFile: this.logFile });
    if (!success) {
      this.boot.error(`No se pudo descargar Docker Desktop: ${err}`);
      return false;
    }

    this.boot.info('Montando e instalando Docker Desktop...');
    await runCommand('hdiutil', ['attach', dest]);
    await runCommand('cp', ['-R', '/Volumes/Docker/Docker.app', '/Applications']);
    await runCommand('hdiutil', ['detach', '/Volumes/Docker']);
    
    this.boot.info('Iniciando Docker Desktop...');
    runCommand('open', ['-a', 'Docker']);
    return true;
  }

  async _installLinux() {
    this.boot.info('Instalando Docker y Docker Compose (requiere sudo)...');
    
    const { success, err } = await runCommand('sudo', ['apt-get', 'update'], { logFile: this.logFile });
    if (!success) {
      this.boot.error(`Fallo actualizando apt: ${err}`);
      return false;
    }

    const { success: installSuccess, err: installErr } = await runCommand('sudo', ['apt-get', 'install', '-y', 'docker.io', 'docker-compose'], { logFile: this.logFile });
    if (!installSuccess) {
      this.boot.error(`Fallo instalando Docker: ${installErr}`);
      return false;
    }

    this.boot.info('Iniciando servicio de Docker...');
    await runCommand('sudo', ['systemctl', 'start', 'docker']);
    await runCommand('sudo', ['systemctl', 'enable', 'docker']);
    
    this.boot.warn('IMPORTANTE: Es posible que necesites añadir tu usuario al grupo docker: sudo usermod -aG docker $USER');
    return true;
  }

  async openDockerDesktop() {
    if (this.platform === 'win32') {
      const candidates = [
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'Docker Desktop.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Docker', 'Docker Desktop.exe')
      ];
      
      for (const exe of candidates) {
        if (fs.existsSync(exe)) {
          runCommand('powershell', ['-Command', `Start-Process -FilePath "${exe}"`]);
          return true;
        }
      }
      return false;
    }
    return false;
  }

  async waitForDaemon(timeout = 600, interval = 5) {
    let elapsed = 0;
    const spinner = (await import('nanospinner')).createSpinner('Esperando a que el daemon de Docker esté disponible...').start();
    
    while (elapsed < timeout) {
      if (await this.isDockerDaemonRunning()) {
        spinner.success({ text: `Docker daemon disponible (tras ${elapsed}s)` });
        return true;
      }
      await new Promise(r => setTimeout(r, interval * 1000));
      elapsed += interval;
      
      if (elapsed === 30) {
        spinner.update({ text: `El daemon de Docker tarda más de 30s en iniciar. Sigo esperando...` });
      }
    }
    spinner.error({ text: 'Timeout: el daemon de Docker no inició' });
    return false;
  }

  async handleDockerDaemonDown() {
    const opened = await this.openDockerDesktop();
    if (opened) {
      this.boot.info('Docker Desktop abriendo. Esperando a que el daemon inicie (30s - 2m).');
    } else {
      this.boot.warn('No se pudo abrir Docker Desktop automáticamente. Ábralo manualmente.');
    }
    return this.waitForDaemon(600, 5);
  }
}
