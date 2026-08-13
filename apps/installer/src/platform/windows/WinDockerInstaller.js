import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from '../../installation/utils/Runner.js';

export class WinDockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
  }

  async isInstalled() {
    const defaultWinPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(defaultWinPath);
  }

  async install() {
    this.boot.info('Descargando Docker Desktop Installer para Windows...');
    const url = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';
    const dest = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'DockerDesktopInstaller.exe');
    
    // Mitigación: Usar curl.exe nativo de Windows (más rápido y eficiente)
    let success, err;
    try {
      const curlRes = await runCommand('curl.exe', ['-L', '-o', dest, url], { logFile: this.logFile });
      success = curlRes.success;
      err = curlRes.err;
    } catch {
      // Fallback a powershell si no hay curl.exe
      const psRes = await runCommand('powershell', ['-Command', `Invoke-WebRequest -Uri "${url}" -OutFile "${dest}"`], { logFile: this.logFile });
      success = psRes.success;
      err = psRes.err;
    }

    if (!success) {
      this.boot.error(`No se pudo descargar Docker Desktop: ${err}`);
      return false;
    }

    this.boot.warn('Se requerirán permisos de Administrador (UAC) para instalar Docker.');
    this.boot.action('Por favor, confirme el cuadro de diálogo que aparecerá a continuación.');
    
    // start-process con -Wait y -Verb RunAs para elevación
    const installRes = await runCommand('powershell', ['-Command', `Start-Process -FilePath "${dest}" -ArgumentList "install --quiet --accept-license" -Wait -Verb RunAs`]);
    
    if (!installRes.success) {
      this.boot.error('La instalación falló (posiblemente canceló los permisos UAC o falló el instalador).');
      return false;
    }

    this.boot.warn('IMPORTANTE: Es probable que deba reiniciar su equipo o cerrar sesión para que Docker sea funcional.');
    return true;
  }

  async isUpdating() {
    try {
      const { out } = await runCommand('tasklist', ['/fi', 'imagename eq Docker Desktop Installer.exe'], { captureAll: true });
      return out && out.includes('Docker Desktop Installer.exe');
    } catch (e) {
      return false;
    }
  }
}
