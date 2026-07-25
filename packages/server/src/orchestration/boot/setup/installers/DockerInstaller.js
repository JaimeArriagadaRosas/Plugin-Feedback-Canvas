import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from '../utils/Runner.js';
import { askConfirm } from '../../../cli.js';

export class DockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
    this.platform = os.platform(); // 'win32', 'darwin', 'linux'
  }

  async isDockerInstalled() {
    const { success } = await runCommand('docker', ['--version']);
    if (success) return true;

    // Fallback: Check standard paths (False Negative prevention)
    if (this.platform === 'win32') {
      const defaultWinPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe');
      if (fs.existsSync(defaultWinPath)) return true;
    } else if (this.platform === 'darwin') {
      if (fs.existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')) return true;
    }
    return false;
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
    this.boot.info('');
    this.boot.warn('Recomendación para macOS: OrbStack es una alternativa a Docker mucho más rápida, que consume menos batería y RAM.');
    const useOrbstack = await askConfirm('¿Deseas instalar OrbStack en lugar de Docker Desktop?');
    
    if (useOrbstack) {
      this.boot.info('Descargando e instalando OrbStack vía Homebrew (requiere brew)...');
      const { success, err } = await runCommand('brew', ['install', '--cask', 'orbstack'], { logFile: this.logFile });
      if (!success) {
        this.boot.error(`Fallo instalando OrbStack vía brew: ${err}`);
        this.boot.action('Instálalo manualmente desde https://orbstack.dev/');
        return false;
      }
      this.boot.info('Iniciando OrbStack...');
      runCommand('open', ['-a', 'OrbStack']);
      return true;
    }

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

  async waitForDaemon(timeout = 600, interval = 5) {
    let elapsed = 0;
    const spinner = (await import('nanospinner')).createSpinner('Esperando a que el daemon de Docker esté disponible...').start();
    
    while (elapsed < timeout) {
      if (await this.isDockerDaemonRunning()) {
        spinner.success({ text: `Docker daemon disponible (tras ${elapsed}s)` });
        return true;
      }

      let isUpdating = false;
      if (this.platform === 'win32') {
        try {
          const { runCommand } = await import('../utils/Runner.js');
          const { stdout } = await runCommand('tasklist', ['/fi', 'imagename eq Docker Desktop Installer.exe']);
          if (stdout && stdout.includes('Docker Desktop Installer.exe')) {
            isUpdating = true;
          }
        } catch (e) { /* ignore */ }
      }

      await new Promise(r => setTimeout(r, interval * 1000));
      elapsed += interval;
      
      if (isUpdating) {
        spinner.update({ text: `Docker Desktop se está actualizando. Esperando adaptativamente (restan ${Math.floor((timeout - elapsed) / 60)} min)...` });
      } else if (elapsed === 30) {
        spinner.update({ text: `El daemon de Docker tarda más de 30s en iniciar. Sigo esperando...` });
      }
    }
    spinner.error({ text: 'Timeout: el daemon de Docker no inició' });
    return false;
  }

  async handleDockerDaemonDown() {
    this.boot.warn('La aplicación de Docker Desktop (Daemon) está cerrada.');
    this.boot.action('👉 Por favor, abre tu aplicación de Docker Desktop para continuar con la instalación.');
    return this.waitForDaemon(600, 5);
  }
}
