import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from '../../utils/Runner.js';
import { askConfirm } from '../../../../cli.js';

export class MacDockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
  }

  async isInstalled() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync('/Applications/Docker.app/Contents/Resources/bin/docker') || fs.existsSync('/Applications/OrbStack.app');
  }

  async install() {
    this.boot.info('');
    this.boot.warn('Recomendación para macOS: OrbStack es una alternativa a Docker más rápida, que consume menos batería y RAM.');
    
    const hasBrew = (await runCommand('brew', ['--version'])).success;
    
    if (hasBrew) {
      const useOrbstack = await askConfirm('¿Deseas instalar OrbStack vía Homebrew en lugar de Docker Desktop?');
      
      if (useOrbstack) {
        this.boot.info('Descargando e instalando OrbStack (Homebrew)...');
        const { success, err } = await runCommand('brew', ['install', '--cask', 'orbstack'], { logFile: this.logFile });
        if (!success) {
          this.boot.error(`Fallo instalando OrbStack vía brew: ${err}`);
          this.boot.action('Por favor instálalo manualmente desde https://orbstack.dev/');
          return false;
        }
        this.boot.info('Iniciando OrbStack...');
        runCommand('open', ['-a', 'OrbStack']);
        this.boot.warn('IMPORTANTE: Finaliza la configuración guiada en la ventana de OrbStack.');
        return true;
      }
    } else {
      this.boot.info('Nota: Homebrew no está instalado. OrbStack requiere instalación manual. Procediendo con Docker Desktop.');
    }

    // Mitigación: Detectar arquitectura dinámicamente para Apple Silicon (M1/M2/M3)
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
    this.boot.info(`Descargando Docker Desktop para macOS (Arquitectura: ${arch})...`);
    
    const url = `https://desktop.docker.com/mac/main/${arch}/Docker.dmg`;
    const dest = path.join(os.tmpdir(), 'Docker.dmg');
    
    const { success, err } = await runCommand('curl', ['-L', '-o', dest, url], { logFile: this.logFile });
    if (!success) {
      this.boot.error(`No se pudo descargar Docker Desktop: ${err}`);
      return false;
    }

    this.boot.info('Montando e instalando Docker Desktop en /Applications...');
    await runCommand('hdiutil', ['attach', dest]);
    await runCommand('cp', ['-R', '/Volumes/Docker/Docker.app', '/Applications']);
    await runCommand('hdiutil', ['detach', '/Volumes/Docker']);
    
    // Mitigación: Advertencia de Gatekeeper (imposibilidad de install silenciosa real)
    this.boot.warn('ATENCIÓN: macOS bloqueará la ejecución silenciosa por seguridad (Gatekeeper).');
    this.boot.action('Docker se abrirá ahora. DEBES confirmar los cuadros de diálogo de seguridad del sistema para completar la instalación.');
    
    runCommand('open', ['-a', 'Docker']);
    return true;
  }

  async isUpdating() {
    return false;
  }
}
